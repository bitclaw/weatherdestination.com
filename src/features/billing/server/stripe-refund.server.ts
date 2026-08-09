import { eq, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { purchases, users } from '@/lib/db/schema';
import { emit } from '@/server/events';
import { invalidateBootstrapCache } from '@/server/functions/bootstrap-cache';
import {
  type Db,
  findSubscriptionByCustomerId,
  stripe,
  unwrapId
} from './stripe-shared.server';

export const handleChargeRefunded = async (charge: Stripe.Charge, db: Db) => {
  if (!charge.refunded) return; // partial refund - manual handling only

  const paymentIntentId = unwrapId(charge.payment_intent);
  const purchase = paymentIntentId
    ? await db.query.purchases.findFirst({
        where: eq(purchases.stripePaymentIntentId, paymentIntentId)
      })
    : null;

  if (purchase) {
    await handlePurchaseRefund(charge, purchase, db);
  } else {
    await handleSubscriptionRefundFallback(charge, db);
  }
};

const handlePurchaseRefund = async (
  charge: Stripe.Charge,
  purchase: typeof purchases.$inferSelect,
  db: Db
) => {
  const now = new Date();
  // Sync callback , bun:sqlite's native transaction() wrapper doesn't await
  // async callbacks (COMMIT fires at the first internal await, before later
  // statements run, with no rollback on a later throw) - an async callback
  // here would make the fresh-read-then-write below non-atomic, defeating
  // the whole point of this fix. All drizzle bun-sqlite calls are
  // synchronous under the hood; .sync()/.run() make that explicit.
  const processed = db.transaction(tx => {
    // Fresh read inside the transaction, not the pre-transaction snapshot -
    // two racing charge.refunded redeliveries would both pass a check on the
    // stale snapshot and double-deduct credits.
    const fresh = tx.query.purchases
      .findFirst({
        where: eq(purchases.id, purchase.id)
      })
      .sync();
    if (!fresh || fresh.refundedAt) return false;

    if (fresh.creditsGranted != null) {
      tx.update(users)
        .set({
          credits: sql`MAX(credits - ${fresh.creditsGranted}, 0)`,
          updatedAt: now
        })
        .where(eq(users.id, fresh.userId))
        .run();
    } else {
      tx.update(users)
        .set({ hasAccess: false, updatedAt: now })
        .where(eq(users.id, fresh.userId))
        .run();
    }
    tx.update(purchases)
      .set({ refundedAt: now })
      .where(eq(purchases.id, fresh.id))
      .run();
    return true;
  });

  if (!processed) return;

  invalidateBootstrapCache(purchase.userId);
  await emit('billing.refunded', {
    userId: purchase.userId,
    kind: purchase.creditsGranted != null ? 'credits' : 'one_time',
    amount: charge.amount_refunded
  });
};

// No matching purchases row - likely a subscription-invoice refund. Revokes
// access defensively; leaves subscriptions.status/plan alone, that table is
// owned by the subscription lifecycle handlers.
//
// Accepted gap: unlike the other subscription handlers, this has no
// isStaleSubscriptionEvent guard , charge.refunded carries no subscription
// reference, and deriving one requires a separate invoicePayments API call
// this Stripe SDK version doesn't support via Charge/PaymentIntent directly.
// Only affects subscription refunds issued without a cancellation (rare);
// worst case self-corrects on the next legitimate subscription.updated sync.
const handleSubscriptionRefundFallback = async (
  charge: Stripe.Charge,
  db: Db
) => {
  const customerId = unwrapId(charge.customer);
  if (!customerId) return;
  const existing = await findSubscriptionByCustomerId(db, customerId);
  if (!existing) return;

  // Sync callback , see handlePurchaseRefund for the reasoning. Fresh-read
  // inside the transaction ensures two racing charge.refunded redeliveries
  // don't both pass a stale hasAccess check and double-fire the emit.
  const processed = db.transaction(tx => {
    const fresh = tx.query.users
      .findFirst({
        where: eq(users.id, existing.userId)
      })
      .sync();
    if (!fresh?.hasAccess) return false;

    tx.update(users)
      .set({ hasAccess: false, updatedAt: new Date() })
      .where(eq(users.id, fresh.id))
      .run();
    return true;
  });

  if (!processed) return;

  invalidateBootstrapCache(existing.userId);
  await emit('billing.refunded', {
    userId: existing.userId,
    kind: 'subscription',
    amount: charge.amount_refunded
  });
};

export const handleChargeDisputeCreated = async (
  dispute: Stripe.Dispute,
  db: Db
) => {
  const paymentIntentId = unwrapId(dispute.payment_intent);

  let userId: string | null = null;

  if (paymentIntentId) {
    const purchase = await db.query.purchases.findFirst({
      where: eq(purchases.stripePaymentIntentId, paymentIntentId)
    });
    userId = purchase?.userId ?? null;
  }

  if (!userId) {
    const charge =
      typeof dispute.charge === 'string'
        ? await stripe.charges.retrieve(dispute.charge)
        : dispute.charge;
    const customerId = unwrapId(charge?.customer);
    if (customerId) {
      const existing = await findSubscriptionByCustomerId(db, customerId);
      userId = existing?.userId ?? null;
    }
  }

  if (!userId) return;

  // Sync callback , see handlePurchaseRefund for the reasoning. Fresh-read
  // inside the transaction ensures two racing charge.dispute.created
  // redeliveries don't both pass a stale hasAccess check and double-fire
  // the emit.
  const processed = db.transaction(tx => {
    const fresh = tx.query.users
      .findFirst({
        where: eq(users.id, userId)
      })
      .sync();
    if (!fresh?.hasAccess) return false;

    tx.update(users)
      .set({ hasAccess: false, updatedAt: new Date() })
      .where(eq(users.id, fresh.id))
      .run();
    return true;
  });

  if (!processed) return;

  invalidateBootstrapCache(userId);
  await emit('billing.disputed', { userId, amount: dispute.amount });
};
