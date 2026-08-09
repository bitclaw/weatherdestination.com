import { describe, expect, it } from 'bun:test';
import type { StripePlan } from '@/config';
import {
  mrrSnapshots,
  payments,
  purchases,
  subscriptions,
  users
} from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makeSubscription, makeUser } from '@/test/fixtures';
import {
  queryAdminAnalytics,
  snapshotCurrentMonthMrr
} from './admin-analytics.server';

// Fixture plans, independent of config.stripe.plans - this project ships
// with zero plans configured (city comparison is free in v1), but the MRR
// math this suite exercises is generic and shouldn't depend on what's
// currently on sale.
const soloPlan: StripePlan = {
  id: 'solo',
  name: 'Solo',
  description: 'Fixture plan for analytics tests',
  features: [],
  recurring: {
    priceId: 'price_solo_monthly',
    price: 9,
    yearlyPriceId: 'price_solo_yearly',
    yearlyPrice: 90
  }
};
const proPlan: StripePlan = {
  id: 'pro',
  name: 'Pro',
  description: 'Fixture plan for analytics tests',
  features: [],
  recurring: {
    priceId: 'price_pro_monthly',
    price: 29,
    yearlyPriceId: 'price_pro_yearly',
    yearlyPrice: 290
  }
};
const plansFixture: StripePlan[] = [soloPlan, proPlan];

describe('queryAdminAnalytics', () => {
  it('returns zeroed metrics on an empty db', async () => {
    const db = makeTestSharedDb();
    const result = await queryAdminAnalytics(db);

    expect(result.overview.mrrCents).toBe(0);
    expect(result.overview.activeSubscribers).toBe(0);
    expect(result.overview.trialsActive).toBe(0);
    expect(result.overview.mrrDeltaCents).toBeNull();
    expect(result.overview.churnRatePct).toBeNull();
    expect(result.planDistribution).toEqual([]);
    expect(result.recentPayments).toEqual([]);
    expect(result.mrrTrend).toEqual([]);
  });

  it('sums MRR across active monthly subscriptions by plan price', async () => {
    const db = makeTestSharedDb();
    const u1 = makeUser();
    const u2 = makeUser();
    await db.insert(users).values([u1, u2]);
    await db
      .insert(subscriptions)
      .values([
        makeSubscription(u1.id, { plan: 'solo', status: 'active' }),
        makeSubscription(u2.id, { plan: 'pro', status: 'active' })
      ]);

    const result = await queryAdminAnalytics(db, new Date(), plansFixture);

    expect(result.overview.mrrCents).toBe(
      Math.round(soloPlan.recurring!.price * 100) +
        Math.round(proPlan.recurring!.price * 100)
    );
    expect(result.overview.activeSubscribers).toBe(2);
  });

  it('prorates a yearly-billed subscription to 1/12 for MRR', async () => {
    const db = makeTestSharedDb();
    const u = makeUser();
    await db.insert(users).values(u);
    await db.insert(subscriptions).values(
      makeSubscription(u.id, {
        plan: 'pro',
        status: 'active',
        stripePriceId: 'price_pro_yearly'
      })
    );

    const result = await queryAdminAnalytics(db, new Date(), plansFixture);

    expect(result.overview.mrrCents).toBe(
      Math.round((proPlan.recurring!.yearlyPrice! / 12) * 100)
    );
  });

  it('excludes non-active subscriptions from MRR and counts trials separately', async () => {
    const db = makeTestSharedDb();
    const active = makeUser();
    const trialing = makeUser();
    const canceled = makeUser();
    await db.insert(users).values([active, trialing, canceled]);
    await db
      .insert(subscriptions)
      .values([
        makeSubscription(active.id, { plan: 'solo', status: 'active' }),
        makeSubscription(trialing.id, { plan: 'pro', status: 'trialing' }),
        makeSubscription(canceled.id, { plan: 'free', status: 'canceled' })
      ]);

    const result = await queryAdminAnalytics(db);

    expect(result.overview.activeSubscribers).toBe(1);
    expect(result.overview.trialsActive).toBe(1);
  });

  it('groups active subscribers by plan', async () => {
    const db = makeTestSharedDb();
    const u1 = makeUser();
    const u2 = makeUser();
    const u3 = makeUser();
    await db.insert(users).values([u1, u2, u3]);
    await db
      .insert(subscriptions)
      .values([
        makeSubscription(u1.id, { plan: 'solo', status: 'active' }),
        makeSubscription(u2.id, { plan: 'solo', status: 'active' }),
        makeSubscription(u3.id, { plan: 'pro', status: 'active' })
      ]);

    const result = await queryAdminAnalytics(db);

    const solo = result.planDistribution.find(p => p.plan === 'solo');
    const pro = result.planDistribution.find(p => p.plan === 'pro');
    expect(solo?.count).toBe(2);
    expect(pro?.count).toBe(1);
  });

  it('returns recent payments newest first, joined with user name', async () => {
    const db = makeTestSharedDb();
    const u = makeUser({ name: 'Ada Lovelace' });
    await db.insert(users).values(u);
    await db.insert(payments).values([
      {
        id: 'p1',
        userId: u.id,
        stripeInvoiceId: 'in_1',
        plan: 'solo',
        amount: 900,
        currency: 'usd',
        createdAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'p2',
        userId: u.id,
        stripeInvoiceId: 'in_2',
        plan: 'solo',
        amount: 900,
        currency: 'usd',
        createdAt: new Date('2026-02-01T00:00:00Z')
      }
    ]);

    const result = await queryAdminAnalytics(db);

    expect(result.recentPayments).toHaveLength(2);
    expect(result.recentPayments[0]?.userId).toBe(u.id);
    expect(result.recentPayments[0]?.name).toBe('Ada Lovelace');
    expect(result.recentPayments[0]?.createdAt.toISOString()).toBe(
      '2026-02-01T00:00:00.000Z'
    );
  });

  it('buckets subscriber growth by createdAt and cancelledAt month', async () => {
    const db = makeTestSharedDb();
    const now = new Date('2026-03-15T00:00:00Z');
    const u1 = makeUser();
    const u2 = makeUser();
    await db.insert(users).values([u1, u2]);
    await db.insert(subscriptions).values([
      makeSubscription(u1.id, {
        plan: 'solo',
        status: 'active',
        createdAt: new Date('2026-03-05T00:00:00Z')
      }),
      makeSubscription(u2.id, {
        plan: 'free',
        status: 'canceled',
        createdAt: new Date('2026-02-01T00:00:00Z'),
        cancelledAt: new Date('2026-03-10T00:00:00Z')
      })
    ]);

    const result = await queryAdminAnalytics(db, now);

    const march = result.subscriberGrowth.find(m => m.month === '2026-03');
    const feb = result.subscriberGrowth.find(m => m.month === '2026-02');
    expect(march?.new).toBe(1);
    expect(march?.cancelled).toBe(1);
    expect(feb?.new).toBe(1);
    expect(feb?.cancelled).toBe(0);
  });

  it('computes churn rate from cancellations in the current calendar month', async () => {
    const db = makeTestSharedDb();
    const now = new Date('2026-03-15T00:00:00Z');
    const active = makeUser();
    const cancelled = makeUser();
    await db.insert(users).values([active, cancelled]);
    await db.insert(subscriptions).values([
      makeSubscription(active.id, { plan: 'solo', status: 'active' }),
      makeSubscription(cancelled.id, {
        plan: 'free',
        status: 'canceled',
        cancelledAt: new Date('2026-03-05T00:00:00Z')
      })
    ]);

    const result = await queryAdminAnalytics(db, now);

    // 1 cancelled / (1 active + 1 cancelled) = 50%
    expect(result.overview.churnRatePct).toBe(50);
  });

  it('counts only one-time/credits refunds in the current month', async () => {
    const db = makeTestSharedDb();
    const now = new Date('2026-03-15T00:00:00Z');
    const u = makeUser();
    await db.insert(users).values(u);
    await db.insert(purchases).values([
      {
        id: 'pu1',
        userId: u.id,
        stripePaymentIntentId: 'pi_1',
        stripePriceId: 'price_test',
        amount: 5000,
        currency: 'usd',
        refundedAt: new Date('2026-03-10T00:00:00Z'),
        createdAt: new Date('2026-03-01T00:00:00Z')
      },
      {
        id: 'pu2',
        userId: u.id,
        stripePaymentIntentId: 'pi_2',
        stripePriceId: 'price_test',
        amount: 3000,
        currency: 'usd',
        refundedAt: new Date('2026-02-01T00:00:00Z'),
        createdAt: new Date('2026-02-01T00:00:00Z')
      }
    ]);

    const result = await queryAdminAnalytics(db, now);

    expect(result.revenue.refundsCount).toBe(1);
    expect(result.revenue.refundsAmountCents).toBe(5000);
  });

  it('computes MRR/subscriber delta from the two most recent snapshots', async () => {
    const db = makeTestSharedDb();
    await db.insert(mrrSnapshots).values([
      {
        id: 's1',
        month: '2026-01',
        mrr: 1000,
        activeSubscribers: 5,
        createdAt: new Date()
      },
      {
        id: 's2',
        month: '2026-02',
        mrr: 1500,
        activeSubscribers: 7,
        createdAt: new Date()
      }
    ]);

    const result = await queryAdminAnalytics(db);

    expect(result.overview.mrrDeltaCents).toBe(500);
    expect(result.overview.activeSubscribersDelta).toBe(2);
    expect(result.mrrTrend).toEqual([
      { month: '2026-01', mrrCents: 1000 },
      { month: '2026-02', mrrCents: 1500 }
    ]);
  });
});

describe('snapshotCurrentMonthMrr', () => {
  it('inserts a snapshot row for the current month', async () => {
    const db = makeTestSharedDb();
    const u = makeUser();
    await db.insert(users).values(u);
    await db
      .insert(subscriptions)
      .values(makeSubscription(u.id, { plan: 'solo', status: 'active' }));

    const now = new Date('2026-03-15T00:00:00Z');
    await snapshotCurrentMonthMrr(db, now, plansFixture);

    const rows = await db.select().from(mrrSnapshots);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.month).toBe('2026-03');
    expect(rows[0]?.mrr).toBe(Math.round(soloPlan.recurring!.price * 100));
    expect(rows[0]?.activeSubscribers).toBe(1);
  });

  it('is idempotent: re-running the same month updates instead of duplicating', async () => {
    const db = makeTestSharedDb();
    const u = makeUser();
    await db.insert(users).values(u);
    await db
      .insert(subscriptions)
      .values(makeSubscription(u.id, { plan: 'solo', status: 'active' }));

    const now = new Date('2026-03-15T00:00:00Z');
    await snapshotCurrentMonthMrr(db, now, plansFixture);

    const u2 = makeUser();
    await db.insert(users).values(u2);
    await db
      .insert(subscriptions)
      .values(makeSubscription(u2.id, { plan: 'pro', status: 'active' }));
    await snapshotCurrentMonthMrr(db, now, plansFixture);

    const rows = await db.select().from(mrrSnapshots);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.activeSubscribers).toBe(2);
  });
});
