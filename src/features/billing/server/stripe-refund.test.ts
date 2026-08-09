import { afterEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { purchases, subscriptions, users } from '@/lib/db/schema';
import { _clearHandlers, on } from '@/server/events';
import { makeTestSharedDb } from '@/test/db';
import { makePurchase, makeSubscription, makeUser } from '@/test/fixtures';
import {
  handleChargeDisputeCreated,
  handleChargeRefunded
} from './stripe-refund.server';
import { makeCharge, makeDispute } from './stripe-test-fixtures';

// ---------------------------------------------------------------------------
// handleChargeRefunded
// ---------------------------------------------------------------------------

describe('handleChargeRefunded', () => {
  afterEach(() => _clearHandlers());

  it('claws back credits from the current balance, clamped at 0', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ credits: 30 });
    await db.insert(users).values(user);
    await db.insert(purchases).values(
      makePurchase(user.id, {
        id: 'purchase_1',
        stripePaymentIntentId: 'pi_refund_1',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_credits',
        amount: 500,
        creditsGranted: 100
      })
    );

    await handleChargeRefunded(
      makeCharge({ paymentIntentId: 'pi_refund_1' }),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.credits).toBe(0); // 30 - 100 clamped at 0, not negative

    const purchase = await db.query.purchases.findFirst({
      where: eq(purchases.id, 'purchase_1')
    });
    expect(purchase?.refundedAt).toBeInstanceOf(Date);
  });

  it('revokes access for a refunded one-time purchase', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(purchases).values(
      makePurchase(user.id, {
        id: 'purchase_2',
        stripePaymentIntentId: 'pi_refund_2',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_lifetime',
        amount: 9900,
        creditsGranted: null
      })
    );

    await handleChargeRefunded(
      makeCharge({ paymentIntentId: 'pi_refund_2' }),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
  });

  it('revokes access for a subscription refund with no matching purchases row', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_sub',
        stripeSubscriptionId: 'sub_test',
        plan: 'pro',
        status: 'active'
      })
    );

    await handleChargeRefunded(
      makeCharge({ paymentIntentId: 'pi_no_purchase', customerId: 'cus_sub' }),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
    expect(sub?.status).toBe('active'); // subscriptions row untouched
  });

  it('replay: redelivered subscription refund event does not double-fire emit or re-revoke', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_sub_replay',
        stripeSubscriptionId: 'sub_replay',
        plan: 'pro',
        status: 'active'
      })
    );

    const calls: unknown[] = [];
    on('billing.refunded', async payload => {
      calls.push(payload);
    });

    const charge = makeCharge({
      paymentIntentId: 'pi_sub_replay',
      customerId: 'cus_sub_replay'
    });
    await handleChargeRefunded(charge, db);
    await handleChargeRefunded(charge, db);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('replay: redelivered refund event does not double-deduct credits', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ credits: 200 });
    await db.insert(users).values(user);
    await db.insert(purchases).values(
      makePurchase(user.id, {
        id: 'purchase_3',
        stripePaymentIntentId: 'pi_refund_3',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_credits',
        amount: 500,
        creditsGranted: 50
      })
    );

    const charge = makeCharge({ paymentIntentId: 'pi_refund_3' });
    await handleChargeRefunded(charge, db);
    await handleChargeRefunded(charge, db);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.credits).toBe(150); // 200 - 50, only once
  });

  it('race: two concurrent deliveries of the same refund event do not double-deduct', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ credits: 200 });
    await db.insert(users).values(user);
    await db.insert(purchases).values(
      makePurchase(user.id, {
        id: 'purchase_race',
        stripePaymentIntentId: 'pi_refund_race',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_credits',
        amount: 500,
        creditsGranted: 50
      })
    );

    const charge = makeCharge({ paymentIntentId: 'pi_refund_race' });
    // Both calls read the purchase row before either has committed a refund,
    // reproducing two racing webhook redeliveries of the same event.
    await Promise.all([
      handleChargeRefunded(charge, db),
      handleChargeRefunded(charge, db)
    ]);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.credits).toBe(150); // 200 - 50, only once
  });

  it('no-op on a partial refund', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ credits: 30 });
    await db.insert(users).values(user);
    await db.insert(purchases).values(
      makePurchase(user.id, {
        id: 'purchase_4',
        stripePaymentIntentId: 'pi_partial',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_credits',
        amount: 500,
        creditsGranted: 100
      })
    );

    await handleChargeRefunded(
      makeCharge({ paymentIntentId: 'pi_partial', refunded: false }),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.credits).toBe(30); // untouched
  });
});

// ---------------------------------------------------------------------------
// handleChargeDisputeCreated
// ---------------------------------------------------------------------------

describe('handleChargeDisputeCreated', () => {
  afterEach(() => _clearHandlers());

  it('revokes access via the matching purchase', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(purchases).values(
      makePurchase(user.id, {
        id: 'purchase_5',
        stripePaymentIntentId: 'pi_dispute_1',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_lifetime',
        amount: 9900
      })
    );

    await handleChargeDisputeCreated(
      makeDispute({ paymentIntentId: 'pi_dispute_1' }),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
  });

  it('falls back to the charge -> customer -> subscription lookup when no purchase matches', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_test',
        plan: 'pro',
        status: 'active'
      })
    );

    // dispute.charge is a plain string id (the real webhook shape) - exercises
    // the actual stripe.charges.retrieve() call via the default MSW handler,
    // which returns { customer: 'cus_test' }.
    await handleChargeDisputeCreated(
      makeDispute({ chargeId: 'ch_test', paymentIntentId: undefined }),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
  });

  it('no-op when neither a purchase nor a subscription customer matches', async () => {
    const db = makeTestSharedDb();
    await expect(
      handleChargeDisputeCreated(makeDispute(), db)
    ).resolves.toBeUndefined();
  });

  it('replay: redelivered dispute event does not double-fire emit or re-revoke', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(purchases).values(
      makePurchase(user.id, {
        id: 'purchase_dispute_replay',
        stripePaymentIntentId: 'pi_dispute_replay',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_lifetime',
        amount: 9900
      })
    );

    const calls: unknown[] = [];
    on('billing.disputed', async payload => {
      calls.push(payload);
    });

    const dispute = makeDispute({ paymentIntentId: 'pi_dispute_replay' });
    await handleChargeDisputeCreated(dispute, db);
    await handleChargeDisputeCreated(dispute, db);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
    expect(calls).toHaveLength(1);
  });
});
