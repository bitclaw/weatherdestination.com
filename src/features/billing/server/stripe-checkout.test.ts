import { afterEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { HttpResponse, http } from 'msw';
import type Stripe from 'stripe';
import { purchases, subscriptions, users } from '@/lib/db/schema';
import { _clearHandlers, on } from '@/server/events';
import { makeTestSharedDb } from '@/test/db';
import { makeSubscription, makeUser } from '@/test/fixtures';
import { mswServer } from '@/test/msw/server';
import { handleCheckoutCompleted } from './stripe-checkout.server';
import { getPlanIdForPriceId } from './stripe-shared.server';
import { makeSession } from './stripe-test-fixtures';

// ---------------------------------------------------------------------------
// handleCheckoutCompleted
// ---------------------------------------------------------------------------

describe('handleCheckoutCompleted', () => {
  afterEach(() => _clearHandlers());

  it('emits subscription.activated exactly once on duplicate webhook delivery', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    const calls: unknown[] = [];
    on('subscription.activated', async payload => {
      calls.push(payload);
    });

    const session = makeSession({
      userId: user.id,
      customerId: 'cus_replay',
      subscriptionId: 'sub_replay'
    });

    await handleCheckoutCompleted(session, db);
    await handleCheckoutCompleted(session, db);

    expect(calls).toHaveLength(1);
  });

  it('creates subscription and grants access', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    await handleCheckoutCompleted(
      makeSession({
        userId: user.id,
        customerId: 'cus_abc',
        subscriptionId: 'sub_xyz'
      }),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(true);

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub?.stripeCustomerId).toBe('cus_abc');
    expect(sub?.stripeSubscriptionId).toBe('sub_xyz');
    expect(sub?.plan).toBe('free');
    expect(sub?.status).toBe('active');
  });

  it('upserts on repeat checkout: does not create duplicate subscription', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db
      .insert(subscriptions)
      .values(
        makeSubscription(user.id, { stripeCustomerId: 'cus_old', plan: 'free' })
      );

    await handleCheckoutCompleted(
      makeSession({
        userId: user.id,
        customerId: 'cus_new',
        subscriptionId: 'sub_new'
      }),
      db
    );

    const allSubs = await db.select().from(subscriptions);
    expect(allSubs).toHaveLength(1);
    expect(allSubs[0]?.stripeCustomerId).toBe('cus_new');
    expect(allSubs[0]?.plan).toBe('free');
  });

  it('no-op when metadata.userId is missing', async () => {
    const db = makeTestSharedDb();

    await handleCheckoutCompleted(
      makeSession({ userId: '', customerId: 'cus_abc' }),
      db
    );

    const allSubs = await db.select().from(subscriptions);
    expect(allSubs).toHaveLength(0);
  });

  it('stores status trialing and trialEndsAt when Stripe sub is trialing at checkout', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    const trialEnd = Math.floor(Date.now() / 1000) + 7 * 86400;
    mswServer.use(
      http.get('https://api.stripe.com/v1/subscriptions/:id', () =>
        HttpResponse.json({
          id: 'sub_xyz',
          object: 'subscription',
          status: 'trialing',
          trial_end: trialEnd,
          customer: 'cus_abc',
          items: {
            data: [
              { price: { id: 'price_test' }, current_period_end: trialEnd }
            ]
          }
        })
      )
    );

    await handleCheckoutCompleted(
      makeSession({
        userId: user.id,
        customerId: 'cus_abc',
        subscriptionId: 'sub_xyz'
      }),
      db
    );

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub?.status).toBe('trialing');
    expect(sub?.trialEndsAt).toBeInstanceOf(Date);
    expect(sub?.trialEndsAt!.getTime()).toBe(trialEnd * 1000);
    // current_period_end lives on the subscription item, not the top-level
    // object - regression check for getPeriodEnd reading the wrong field.
    expect(sub?.currentPeriodEnd).toBeInstanceOf(Date);
    expect(sub?.currentPeriodEnd!.getTime()).toBe(trialEnd * 1000);

    const u = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    expect(u?.hasAccess).toBe(true);
  });

  it('derives the price id from the retrieved subscription, not session.line_items', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    // makeSession's line_items is always null (checkout.session.completed
    // webhook payloads don't expand it by default) - the retrieved
    // subscription is the only reliable source of the price id.
    mswServer.use(
      http.get('https://api.stripe.com/v1/subscriptions/:id', () =>
        HttpResponse.json({
          id: 'sub_xyz',
          object: 'subscription',
          status: 'active',
          customer: 'cus_abc',
          items: {
            data: [
              {
                price: { id: 'price_from_stripe_sub' },
                current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400
              }
            ]
          }
        })
      )
    );

    await handleCheckoutCompleted(
      makeSession({
        userId: user.id,
        customerId: 'cus_abc',
        subscriptionId: 'sub_xyz'
      }),
      db
    );

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub?.stripePriceId).toBe('price_from_stripe_sub');
  });

  it('no-ops a one_time session when billing.mode is not one_time', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    await handleCheckoutCompleted(
      {
        metadata: { userId: user.id, kind: 'one_time' },
        customer: 'cus_abc',
        payment_intent: 'pi_test',
        line_items: null,
        amount_total: 999,
        currency: 'usd'
      } as unknown as Stripe.Checkout.Session,
      db,
      'subscription'
    );

    expect(await db.select().from(purchases)).toHaveLength(0);
    const u = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(u?.hasAccess).toBe(false);
  });

  it('no-ops a subscription session when billing.mode is not subscription', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    await handleCheckoutCompleted(
      makeSession({ userId: user.id, customerId: 'cus_abc' }),
      db,
      'one_time'
    );

    expect(await db.select().from(subscriptions)).toHaveLength(0);
    const u = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(u?.hasAccess).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPlanIdForPriceId
// ---------------------------------------------------------------------------

describe('getPlanIdForPriceId', () => {
  // Injected fixture with real price ids: config.stripe.plans has empty ids
  // under bun test, so testing against config alone can never distinguish
  // "correctly rejects unknown" from "always returns undefined".
  const plansFixture = [
    {
      id: 'solo',
      name: 'Solo',
      description: '',
      features: [],
      recurring: {
        priceId: 'price_solo_monthly',
        price: 9,
        yearlyPriceId: 'price_solo_yearly',
        yearlyPrice: 90
      }
    },
    {
      id: 'pro',
      name: 'Pro',
      description: '',
      features: [],
      recurring: {
        priceId: 'price_pro_monthly',
        price: 29,
        yearlyPriceId: 'price_pro_yearly',
        yearlyPrice: 290
      }
    }
  ] as unknown as Parameters<typeof getPlanIdForPriceId>[1];

  it('maps a monthly price ID to its plan', () => {
    expect(getPlanIdForPriceId('price_pro_monthly', plansFixture)).toBe('pro');
    expect(getPlanIdForPriceId('price_solo_monthly', plansFixture)).toBe(
      'solo'
    );
  });

  it('maps a yearly price ID to its plan', () => {
    expect(getPlanIdForPriceId('price_pro_yearly', plansFixture)).toBe('pro');
    expect(getPlanIdForPriceId('price_solo_yearly', plansFixture)).toBe('solo');
  });

  it('returns undefined for an unknown price ID instead of silently granting pro access', () => {
    expect(
      getPlanIdForPriceId('price_completely_unknown_xxx', plansFixture)
    ).toBeUndefined();
    expect(getPlanIdForPriceId('price_completely_unknown_xxx')).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(getPlanIdForPriceId(null, plansFixture)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(getPlanIdForPriceId(undefined, plansFixture)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handleCreditsPurchase (via handleCheckoutCompleted, kind: 'credits')
// ---------------------------------------------------------------------------

describe('handleCreditsPurchase', () => {
  const makeCreditsSession = (userId: string, paymentIntentId: string) =>
    ({
      metadata: { userId, kind: 'credits', amount: '100' },
      customer: 'cus_credits',
      payment_intent: paymentIntentId,
      line_items: null,
      amount_total: 500,
      currency: 'usd'
    }) as unknown as Stripe.Checkout.Session;

  it('grants credits and records a purchase row', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ credits: 10 });
    await db.insert(users).values(user);

    await handleCheckoutCompleted(makeCreditsSession(user.id, 'pi_c1'), db);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.credits).toBe(110);

    const rows = await db.select().from(purchases);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.stripePaymentIntentId).toBe('pi_c1');
  });

  it('replay: duplicate webhook delivery grants credits exactly once', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ credits: 10 });
    await db.insert(users).values(user);

    const session = makeCreditsSession(user.id, 'pi_c2');
    await handleCheckoutCompleted(session, db);
    await handleCheckoutCompleted(session, db);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.credits).toBe(110);

    const rows = await db.select().from(purchases);
    expect(rows).toHaveLength(1);
  });

  it('no-op when metadata.userId is missing', async () => {
    const db = makeTestSharedDb();
    await handleCheckoutCompleted(makeCreditsSession('', 'pi_c3'), db);
    expect(await db.select().from(purchases)).toHaveLength(0);
  });
});
