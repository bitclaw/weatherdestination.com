import { randomUUIDv7 } from 'bun';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { payments, subscriptions, users } from '@/lib/db/schema';
import { invalidateBootstrapCache } from '@/server/functions/bootstrap-cache';
import { isSubscriptionActive } from './billing.rules.server';
import { invalidateSubscriptionCache } from './billing.server';
import {
  type Db,
  getPeriodEnd,
  getPlanIdForPriceId,
  parseTrialEnd,
  unwrapId
} from './stripe-shared.server';

// Stripe doesn't guarantee webhook delivery order. If this customer has
// since replaced their subscription (existing.stripeSubscriptionId no
// longer matches the incoming event's sub id), the event is stale/delayed
// for a subscription that's no longer current , applying it would overwrite
// the newer, legitimately active subscription.
const isStaleSubscriptionEvent = (
  existingSubId: string | null,
  incomingSubId: string | null | undefined
): boolean =>
  Boolean(existingSubId) &&
  Boolean(incomingSubId) &&
  existingSubId !== incomingSubId;

export const handleSubscriptionUpdate = async (
  sub: Stripe.Subscription,
  db: Db
) => {
  const customerId = unwrapId(sub.customer);
  if (!customerId) return;

  const isActive = isSubscriptionActive(sub);
  const trialEndsAt = parseTrialEnd(
    (sub as unknown as Record<string, unknown>).trial_end as
      | number
      | null
      | undefined
  );
  const now = new Date();
  // Sync callback , bun:sqlite's native transaction() wrapper doesn't await
  // async callbacks (COMMIT fires at the first internal await, with no
  // rollback on a later throw). All drizzle bun-sqlite calls are synchronous
  // under the hood; .run() makes that explicit.
  const userId = db.transaction(tx => {
    // Fresh read inside the transaction, not a pre-transaction snapshot -
    // two racing webhooks (this customer's old subscription.deleted and a
    // new subscription.updated arriving concurrently) would both pass the
    // stale-event check on a stale snapshot and the later-committing one
    // could overwrite the other's already-current state.
    const existing = tx.query.subscriptions
      .findFirst({ where: eq(subscriptions.stripeCustomerId, customerId) })
      .sync();
    if (!existing) return null;
    if (isStaleSubscriptionEvent(existing.stripeSubscriptionId, sub.id)) {
      return null;
    }

    tx.update(subscriptions)
      .set({
        status: sub.status,
        plan: isActive
          ? (getPlanIdForPriceId(sub.items?.data[0]?.price?.id) ?? 'free')
          : 'free',
        currentPeriodEnd: getPeriodEnd(sub),
        trialEndsAt,
        lastSyncedAt: now,
        updatedAt: now
      })
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .run();

    tx.update(users)
      .set({ hasAccess: isActive, updatedAt: now })
      .where(eq(users.id, existing.userId))
      .run();

    return existing.userId;
  });

  if (!userId) return;
  invalidateSubscriptionCache(userId);
  invalidateBootstrapCache(userId);
};

export const handleSubscriptionDeleted = async (
  sub: Stripe.Subscription,
  db: Db
) => {
  const customerId = unwrapId(sub.customer);
  if (!customerId) return;

  const now = new Date();
  // Sync callback , see the comment on handleSubscriptionUpdate's transaction.
  const userId = db.transaction(tx => {
    // Fresh read inside the transaction , see the comment on
    // handleSubscriptionUpdate's transaction for why.
    const existing = tx.query.subscriptions
      .findFirst({ where: eq(subscriptions.stripeCustomerId, customerId) })
      .sync();
    if (!existing) return null;
    if (isStaleSubscriptionEvent(existing.stripeSubscriptionId, sub.id)) {
      return null;
    }

    tx.update(subscriptions)
      .set({
        status: 'canceled',
        plan: 'free',
        currentPeriodEnd: null,
        cancelledAt: now,
        lastSyncedAt: now,
        updatedAt: now
      })
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .run();

    tx.update(users)
      .set({ hasAccess: false, updatedAt: now })
      .where(eq(users.id, existing.userId))
      .run();

    return existing.userId;
  });

  if (!userId) return;
  invalidateSubscriptionCache(userId);
  invalidateBootstrapCache(userId);
};

// Records recurring subscription revenue for the analytics dashboard. Fires
// for every successful invoice, including the first one created alongside
// checkout.session.completed - stripeInvoiceId is unique, so a redelivery
// of either event just no-ops on the second insert.
export const handleInvoicePaid = async (invoice: Stripe.Invoice, db: Db) => {
  const customerId = unwrapId(invoice.customer);
  if (!customerId) return;

  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeCustomerId, customerId)
  });
  if (!existing) return;

  const priceId = unwrapId(
    invoice.lines?.data[0]?.pricing?.price_details?.price ?? null
  );
  const plan = getPlanIdForPriceId(priceId) ?? existing.plan;

  await db
    .insert(payments)
    .values({
      id: randomUUIDv7(),
      userId: existing.userId,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: customerId,
      plan,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      createdAt: new Date(invoice.created * 1000)
    })
    .onConflictDoNothing();
};

export const handlePaymentFailed = async (invoice: Stripe.Invoice, db: Db) => {
  const customerId = unwrapId(invoice.customer);
  if (!customerId) return;

  const invoiceSubId = unwrapId(
    invoice.parent?.subscription_details?.subscription
  );

  const now = new Date();
  // Sync callback , see the comment on handleSubscriptionUpdate's transaction.
  const userId = db.transaction(tx => {
    // Fresh read inside the transaction , see the comment on
    // handleSubscriptionUpdate's transaction for why.
    const existing = tx.query.subscriptions
      .findFirst({ where: eq(subscriptions.stripeCustomerId, customerId) })
      .sync();
    if (!existing) return null;
    if (isStaleSubscriptionEvent(existing.stripeSubscriptionId, invoiceSubId)) {
      return null;
    }

    tx.update(subscriptions)
      .set({ status: 'past_due', lastSyncedAt: now, updatedAt: now })
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .run();

    tx.update(users)
      .set({ hasAccess: false, updatedAt: now })
      .where(eq(users.id, existing.userId))
      .run();

    return existing.userId;
  });

  if (!userId) return;
  invalidateSubscriptionCache(userId);
  invalidateBootstrapCache(userId);
};
