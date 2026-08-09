import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { payments, subscriptions, users } from '@/lib/db/schema';
import { bootstrapCache } from '@/server/functions/bootstrap-cache';
import { makeTestSharedDb } from '@/test/db';
import { makeSubscription, makeUser } from '@/test/fixtures';
import { getCachedSubscription } from './billing.server';
import {
  handleInvoicePaid,
  handlePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdate
} from './stripe-subscription.server';
import { makeInvoice, makeStripeSub } from './stripe-test-fixtures';

// priceId deliberately unmatched against config.stripe.plans (empty under
// bun test - see stripe-checkout.test.ts's getPlanIdForPriceId section for
// why): handleInvoicePaid's fallback to the subscription's current plan on
// a miss is the behavior under test here, not price-id matching itself.
const makePaidInvoice = (
  customerId: string,
  override?: Partial<{ id: string; amountPaid: number }>
) =>
  ({
    id: override?.id ?? 'in_test',
    customer: customerId,
    amount_paid: override?.amountPaid ?? 2900,
    currency: 'usd',
    created: Math.floor(Date.now() / 1000),
    lines: {
      data: [{ pricing: { price_details: { price: 'price_unmatched' } } }]
    }
  }) as unknown as Stripe.Invoice;

// ---------------------------------------------------------------------------
// handleSubscriptionUpdate
// ---------------------------------------------------------------------------

describe('handleSubscriptionUpdate', () => {
  const setup = async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        plan: 'pro',
        status: 'active'
      })
    );
    return { db, userId: user.id };
  };

  it('keeps access when status is active', async () => {
    const { db, userId } = await setup();
    await handleSubscriptionUpdate(makeStripeSub('cus_abc', 'active'), db);
    const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const s = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId)
    });
    expect(u?.hasAccess).toBe(true);
    expect(s?.plan).toBe('free');
  });

  it('keeps access when status is trialing', async () => {
    const { db, userId } = await setup();
    await handleSubscriptionUpdate(makeStripeSub('cus_abc', 'trialing'), db);
    const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(u?.hasAccess).toBe(true);
  });

  it('revokes access when status is past_due', async () => {
    const { db, userId } = await setup();
    await handleSubscriptionUpdate(makeStripeSub('cus_abc', 'past_due'), db);
    const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const s = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId)
    });
    expect(u?.hasAccess).toBe(false);
    expect(s?.plan).toBe('free');
    expect(s?.status).toBe('past_due');
  });

  it('revokes access when status is canceled', async () => {
    const { db, userId } = await setup();
    await handleSubscriptionUpdate(makeStripeSub('cus_abc', 'canceled'), db);
    const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(u?.hasAccess).toBe(false);
  });

  it('stores trialEndsAt when Stripe sub has trial_end', async () => {
    const { db, userId } = await setup();
    const trialEnd = Math.floor(Date.now() / 1000) + 7 * 86400;

    await handleSubscriptionUpdate(
      makeStripeSub('cus_abc', 'trialing', { trial_end: trialEnd }),
      db
    );

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId)
    });
    expect(sub?.status).toBe('trialing');
    expect(sub?.trialEndsAt).toBeInstanceOf(Date);
    expect(sub?.trialEndsAt!.getTime()).toBe(trialEnd * 1000);
  });

  it('clears trialEndsAt when trial ends and sub becomes active', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        plan: 'pro',
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 7 * 86400 * 1000)
      })
    );

    await handleSubscriptionUpdate(makeStripeSub('cus_abc', 'active'), db);

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub?.status).toBe('active');
    expect(sub?.trialEndsAt).toBeNull();

    const u = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    expect(u?.hasAccess).toBe(true);
  });

  it('no-op when customer not found', async () => {
    const db = makeTestSharedDb();
    await expect(
      handleSubscriptionUpdate(makeStripeSub('cus_unknown', 'active'), db)
    ).resolves.toBeUndefined();
  });

  it('ignores a stale event for a subscription the customer has since replaced', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_new',
        plan: 'pro',
        status: 'active'
      })
    );

    // Delayed event for the customer's old (already-replaced) subscription.
    await handleSubscriptionUpdate(
      makeStripeSub('cus_abc', 'canceled', { id: 'sub_old' }),
      db
    );

    const u = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    const s = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(u?.hasAccess).toBe(true);
    expect(s?.status).toBe('active');
    expect(s?.plan).toBe('pro');
  });

  it('replay: redelivered update event converges to the same state, not cumulative', async () => {
    const { db, userId } = await setup();
    const event = makeStripeSub('cus_abc', 'past_due');
    await handleSubscriptionUpdate(event, db);
    await handleSubscriptionUpdate(event, db);

    const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const s = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId)
    });
    expect(u?.hasAccess).toBe(false);
    expect(s?.status).toBe('past_due');
    expect(s?.plan).toBe('free');
  });
});

// ---------------------------------------------------------------------------
// handleSubscriptionDeleted
// ---------------------------------------------------------------------------

describe('handleSubscriptionDeleted', () => {
  it('cancels subscription and revokes access', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        plan: 'pro',
        status: 'active'
      })
    );

    await handleSubscriptionDeleted(makeStripeSub('cus_abc', 'canceled'), db);

    const u = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    const s = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(u?.hasAccess).toBe(false);
    expect(s?.status).toBe('canceled');
    expect(s?.plan).toBe('free');
  });

  it('no-op when customer not found', async () => {
    const db = makeTestSharedDb();
    await expect(
      handleSubscriptionDeleted(makeStripeSub('cus_unknown', 'canceled'), db)
    ).resolves.toBeUndefined();
  });

  it('ignores a stale deletion event for a subscription the customer has since replaced', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_new',
        plan: 'pro',
        status: 'active'
      })
    );

    await handleSubscriptionDeleted(
      makeStripeSub('cus_abc', 'canceled', { id: 'sub_old' }),
      db
    );

    const u = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    const s = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(u?.hasAccess).toBe(true);
    expect(s?.status).toBe('active');
    expect(s?.plan).toBe('pro');
  });

  it('replay: redelivered deletion event converges to the same state, not cumulative', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        plan: 'pro',
        status: 'active'
      })
    );

    const event = makeStripeSub('cus_abc', 'canceled');
    await handleSubscriptionDeleted(event, db);
    await handleSubscriptionDeleted(event, db);

    const u = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    const s = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(u?.hasAccess).toBe(false);
    expect(s?.status).toBe('canceled');
    expect(s?.plan).toBe('free');
  });
});

// ---------------------------------------------------------------------------
// handlePaymentFailed
// ---------------------------------------------------------------------------

describe('handlePaymentFailed', () => {
  it('revokes access and marks subscription past_due on payment failure', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_test',
        plan: 'pro',
        status: 'active'
      })
    );

    await handlePaymentFailed(makeInvoice('cus_abc'), db);

    const u = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    const s = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(u?.hasAccess).toBe(false);
    expect(s?.status).toBe('past_due');
  });

  it('invalidates the bootstrap and subscription caches', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_test',
        plan: 'pro',
        status: 'active'
      })
    );

    // Populate both caches with pre-failure state.
    bootstrapCache.set(user.id, {
      user: { id: user.id, email: user.email, name: user.name, image: null },
      hasAccess: true,
      plan: 'pro',
      isTrialing: false,
      trialEndsAt: null,
      isAdmin: false,
      onboardingComplete: true,
      credits: 0
    });
    const cachedBefore = await getCachedSubscription(user.id, db);
    expect(cachedBefore?.status).toBe('active');

    await handlePaymentFailed(makeInvoice('cus_abc'), db);

    expect(bootstrapCache.get(user.id)).toBeUndefined();
    const cachedAfter = await getCachedSubscription(user.id, db);
    expect(cachedAfter?.status).toBe('past_due');
  });

  it('ignores a stale event for a subscription the customer has since replaced', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_new',
        plan: 'pro',
        status: 'active'
      })
    );

    await handlePaymentFailed(makeInvoice('cus_abc', 'sub_old'), db);

    const u = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    const s = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(u?.hasAccess).toBe(true);
    expect(s?.status).toBe('active');
  });

  it('no-op when customer not found', async () => {
    const db = makeTestSharedDb();
    await expect(
      handlePaymentFailed(makeInvoice('cus_unknown'), db)
    ).resolves.toBeUndefined();
  });

  it('replay: redelivered payment-failed event converges to the same state, not cumulative', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_test',
        plan: 'pro',
        status: 'active'
      })
    );

    const event = makeInvoice('cus_abc');
    await handlePaymentFailed(event, db);
    await handlePaymentFailed(event, db);

    const u = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    const s = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(u?.hasAccess).toBe(false);
    expect(s?.status).toBe('past_due');
  });
});

// ---------------------------------------------------------------------------
// handleInvoicePaid
// ---------------------------------------------------------------------------

describe('handleInvoicePaid', () => {
  it('records a payments row for the subscription owner', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        plan: 'pro',
        status: 'active'
      })
    );

    await handleInvoicePaid(
      makePaidInvoice('cus_abc', { id: 'in_1', amountPaid: 2900 }),
      db
    );

    const rows = await db.select().from(payments);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(user.id);
    expect(rows[0]?.stripeInvoiceId).toBe('in_1');
    expect(rows[0]?.amount).toBe(2900);
    // Unmatched price id falls back to the subscription's current plan
    // rather than dropping the row or throwing.
    expect(rows[0]?.plan).toBe('pro');
  });

  it('no-ops when the customer has no subscription row', async () => {
    const db = makeTestSharedDb();
    await expect(
      handleInvoicePaid(makePaidInvoice('cus_unknown'), db)
    ).resolves.toBeUndefined();
    expect(await db.select().from(payments)).toHaveLength(0);
  });

  it('replay: duplicate invoice.paid delivery records the payment exactly once', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_abc',
        plan: 'pro',
        status: 'active'
      })
    );

    const invoice = makePaidInvoice('cus_abc', { id: 'in_replay' });
    await handleInvoicePaid(invoice, db);
    await handleInvoicePaid(invoice, db);

    expect(await db.select().from(payments)).toHaveLength(1);
  });
});
