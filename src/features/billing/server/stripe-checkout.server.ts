import { randomUUIDv7 } from 'bun';
import { eq, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { config } from '@/config';
import { purchases, subscriptions, users } from '@/lib/db/schema';
import { emit } from '@/server/events';
import { invalidateBootstrapCache } from '@/server/functions/bootstrap-cache';
import { invalidateSubscriptionCache } from './billing.server';
import {
  type BillingMode,
  type Db,
  getPeriodEnd,
  getPlanIdForPriceId,
  parseTrialEnd,
  stripe,
  unwrapId
} from './stripe-shared.server';

// 100,000x the default per-top-up grant - generous enough for any realistic
// configured top-up tier, bounded enough to reject an absurd or negative
// value (see handleCreditsPurchase's own comment for the threat this
// guards).
const MAX_CREDIT_TOP_UP = 10_000_000;

export const handleCheckoutCompleted = async (
  session: Stripe.Checkout.Session,
  db: Db,
  mode: BillingMode = config.billing.mode
) => {
  if (session.metadata?.kind === 'credits') {
    await handleCreditsPurchase(session, db);
  } else if (session.metadata?.kind === 'one_time') {
    if (mode !== 'one_time') return;
    await handleOneTimePurchase(session, db);
  } else {
    if (mode !== 'subscription') return;
    await handleSubscriptionCheckout(session, db);
  }
};

const handleCreditsPurchase = async (
  session: Stripe.Checkout.Session,
  db: Db
) => {
  const userId = session.metadata?.userId;
  if (!userId) return;
  const amount = Number(
    session.metadata?.amount ?? config.credits.creditsPerTopUp
  );
  // Bounded even though not client-reachable today (session.metadata.amount
  // is only ever set by our own createCheckoutSessionFn, and the webhook
  // signature is verified) - a Stripe Dashboard operator editing session
  // metadata by hand is still a path to an unbounded or negative credit
  // grant (sql`credits + ${amount}` with amount < 0 silently deducts).
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_CREDIT_TOP_UP) {
    return;
  }

  // Stripe delivers webhooks at least once. Dedup on the payment intent
  // (same pattern as handleOneTimePurchase) inside the same transaction as
  // the grant, so a crash between the two can't strand one without the
  // other. No payment intent means nothing to dedup on , bail out rather
  // than granting credits unconditionally.
  const paymentIntentId = unwrapId(session.payment_intent);
  if (!paymentIntentId) return;

  const customerId = unwrapId(session.customer);

  let granted = false;
  // Sync callback , bun:sqlite's native transaction() wrapper doesn't await
  // async callbacks (COMMIT fires at the first internal await, before later
  // statements run, with no rollback on a later throw). All drizzle bun-sqlite
  // calls are synchronous under the hood; .sync()/.run() make that explicit.
  db.transaction(tx => {
    const existing = tx.query.purchases
      .findFirst({
        where: eq(purchases.stripePaymentIntentId, paymentIntentId)
      })
      .sync();
    if (existing) return;

    tx.insert(purchases)
      .values({
        id: randomUUIDv7(),
        userId,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
        stripePriceId: config.credits.topUpPriceId ?? '',
        amount: session.amount_total ?? 0,
        currency: session.currency ?? 'usd',
        creditsGranted: amount,
        createdAt: new Date()
      })
      .run();

    tx.update(users)
      .set({ credits: sql`credits + ${amount}`, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .run();
    granted = true;
  });

  if (granted) {
    invalidateBootstrapCache(userId);
    await emit('credits.purchased', { userId, amount });
  }
};

const handleSubscriptionCheckout = async (
  session: Stripe.Checkout.Session,
  db: Db
) => {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const customerId = unwrapId(session.customer);
  if (!customerId) return;

  // Retrieve the Stripe sub before opening the DB transaction to avoid holding
  // a txn open during an HTTP call. This gives us real status/period/trial data
  // since checkout.session.completed fires before customer.subscription.updated.
  const subId = unwrapId(session.subscription);
  const stripeSub = subId ? await stripe.subscriptions.retrieve(subId) : null;

  const subStatus = stripeSub?.status ?? 'active';
  const subPeriodEnd = stripeSub ? getPeriodEnd(stripeSub) : null;
  const subTrialEndsAt = parseTrialEnd(stripeSub?.trial_end);
  // session.line_items isn't expanded in a standard checkout.session.completed
  // webhook payload, so it's null in production - the retrieved stripeSub
  // (which has real items data) is the reliable source. Fall back to
  // session.line_items only in case a caller has expanded it.
  const priceId =
    stripeSub?.items?.data[0]?.price?.id ??
    session.line_items?.data[0]?.price?.id ??
    null;

  let userEmail: string | undefined;
  let userName: string | undefined;
  let isReplay = false;

  // Sync callback , see the comment on handleCreditsPurchase's transaction.
  db.transaction(tx => {
    const user = tx.query.users
      .findFirst({
        where: eq(users.id, userId)
      })
      .sync();
    userEmail = user?.email;
    userName = user?.name ?? undefined;

    // Stripe redelivers checkout.session.completed at least once. The upsert
    // below is idempotent, but the subscription.activated emit (receipt email,
    // trial-expiring job) must fire only for the first delivery: if our row
    // already carries this checkout's subscription id, this is a replay.
    if (subId) {
      const existingSub = tx.query.subscriptions
        .findFirst({
          where: eq(subscriptions.userId, userId),
          columns: { stripeSubscriptionId: true }
        })
        .sync();
      isReplay = existingSub?.stripeSubscriptionId === subId;
    }

    tx.update(users)
      .set({ hasAccess: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .run();

    tx.insert(subscriptions)
      .values({
        id: randomUUIDv7(),
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subId ?? null,
        stripePriceId: priceId,
        plan: getPlanIdForPriceId(priceId) ?? 'free',
        status: subStatus,
        currentPeriodEnd: subPeriodEnd,
        trialEndsAt: subTrialEndsAt,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          stripeCustomerId: customerId,
          plan: getPlanIdForPriceId(priceId) ?? 'free',
          status: subStatus,
          currentPeriodEnd: subPeriodEnd,
          trialEndsAt: subTrialEndsAt,
          updatedAt: new Date()
        }
      })
      .run();
  });

  invalidateSubscriptionCache(userId);
  invalidateBootstrapCache(userId);

  if (userEmail && !isReplay) {
    await emit('subscription.activated', {
      userId,
      planId: priceId,
      email: userEmail,
      name: userName,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'usd'
    });
  }
};

export const handleOneTimePurchase = async (
  session: Stripe.Checkout.Session,
  db: Db
) => {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const paymentIntentId = unwrapId(session.payment_intent);
  if (!paymentIntentId) return;

  const customerId = unwrapId(session.customer);

  const stripePriceId =
    session.metadata?.priceId ?? session.line_items?.data[0]?.price?.id ?? '';

  const now = new Date();
  let userEmail: string | undefined;
  let userName: string | undefined;
  let isNewPurchase = false;

  // Sync callback , see the comment on handleCreditsPurchase's transaction.
  db.transaction(tx => {
    const user = tx.query.users
      .findFirst({
        where: eq(users.id, userId)
      })
      .sync();
    userEmail = user?.email;
    userName = user?.name ?? undefined;

    const existing = tx.query.purchases
      .findFirst({
        where: eq(purchases.stripePaymentIntentId, paymentIntentId)
      })
      .sync();

    if (!existing) {
      tx.insert(purchases)
        .values({
          id: randomUUIDv7(),
          userId,
          stripePaymentIntentId: paymentIntentId,
          stripeCustomerId: customerId,
          stripePriceId,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          createdAt: now
        })
        .run();
      isNewPurchase = true;
    }

    tx.update(users)
      .set({ hasAccess: true, updatedAt: now })
      .where(eq(users.id, userId))
      .run();
  });

  invalidateBootstrapCache(userId);

  if (isNewPurchase && userEmail) {
    await emit('purchase.completed', {
      userId,
      email: userEmail,
      name: userName,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'usd'
    });
  }
};
