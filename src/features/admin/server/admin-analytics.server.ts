import { randomUUIDv7 } from 'bun';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { config, type StripePlan } from '@/config';
import type { db as sharedDb } from '@/lib/db';
import {
  mrrSnapshots,
  payments,
  purchases,
  subscriptions,
  users
} from '@/lib/db/schema';

type Db = typeof sharedDb;

// Yearly-billed subs are matched by stripePriceId against the plan's
// yearlyPriceId (subscriptions doesn't store billing interval directly);
// their MRR contribution is yearlyPrice / 12, not the full monthly price.
export const monthlyRevenueCentsForSub = (
  sub: { plan: string; stripePriceId: string | null },
  plans: readonly StripePlan[] = config.stripe.plans
): number => {
  const plan = plans.find(p => p.id === sub.plan);
  if (!plan?.recurring) return 0;
  if (
    sub.stripePriceId &&
    plan.recurring.yearlyPriceId &&
    sub.stripePriceId === plan.recurring.yearlyPriceId &&
    plan.recurring.yearlyPrice
  ) {
    return Math.round((plan.recurring.yearlyPrice / 12) * 100);
  }
  return Math.round(plan.recurring.price * 100);
};

const last12Months = (now: Date = new Date()): string[] => {
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    );
  }
  return months;
};

export type AdminAnalytics = {
  overview: {
    mrrCents: number;
    mrrDeltaCents: number | null;
    activeSubscribers: number;
    activeSubscribersDelta: number | null;
    trialsActive: number;
    churnRatePct: number | null;
  };
  revenue: {
    mrrCents: number;
    mrrDeltaCents: number | null;
    arpuCents: number;
    refundsCount: number;
    refundsAmountCents: number;
  };
  mrrTrend: Array<{ month: string; mrrCents: number }>;
  planDistribution: Array<{ plan: string; count: number }>;
  recentPayments: Array<{
    userId: string;
    name: string;
    plan: string;
    amountCents: number;
    createdAt: Date;
  }>;
  subscriberGrowth: Array<{ month: string; new: number; cancelled: number }>;
};

// Idempotent: re-running within the same month overwrites that month's row
// (onConflictDoUpdate on the unique `month` key) rather than duplicating it,
// so the cron can safely run more than once in a month without skewing the
// trend chart.
export const snapshotCurrentMonthMrr = async (
  db: Db,
  now: Date = new Date()
): Promise<void> => {
  const activeSubs = await db
    .select({
      plan: subscriptions.plan,
      stripePriceId: subscriptions.stripePriceId
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'active'));

  const mrr = activeSubs.reduce(
    (sum, s) => sum + monthlyRevenueCentsForSub(s),
    0
  );
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await db
    .insert(mrrSnapshots)
    .values({
      id: randomUUIDv7(),
      month,
      mrr,
      activeSubscribers: activeSubs.length,
      createdAt: now
    })
    .onConflictDoUpdate({
      target: mrrSnapshots.month,
      set: { mrr, activeSubscribers: activeSubs.length }
    });
};

export const queryAdminAnalytics = async (
  db: Db,
  now: Date = new Date(),
  plans: readonly StripePlan[] = config.stripe.plans
): Promise<AdminAnalytics> => {
  const activeSubs = await db
    .select({
      plan: subscriptions.plan,
      stripePriceId: subscriptions.stripePriceId
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'active'));

  const mrrCents = activeSubs.reduce(
    (sum, s) => sum + monthlyRevenueCentsForSub(s, plans),
    0
  );
  const activeSubscribers = activeSubs.length;
  const arpuCents =
    activeSubscribers > 0 ? Math.round(mrrCents / activeSubscribers) : 0;

  const trialsActiveRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'trialing'));
  const trialsActive = trialsActiveRow[0]?.count ?? 0;

  // Populated monthly by the analytics:snapshot-mrr cron job. Months before
  // this feature shipped have no row - not backfilled, not simulated.
  const snapshots = await db
    .select()
    .from(mrrSnapshots)
    .orderBy(desc(mrrSnapshots.month))
    .limit(12);
  const mrrTrend = [...snapshots]
    .reverse()
    .map(s => ({ month: s.month, mrrCents: s.mrr }));

  const [lastSnapshot, prevSnapshot] = snapshots;
  const mrrDeltaCents =
    lastSnapshot && prevSnapshot ? lastSnapshot.mrr - prevSnapshot.mrr : null;
  const activeSubscribersDelta =
    lastSnapshot && prevSnapshot
      ? lastSnapshot.activeSubscribers - prevSnapshot.activeSubscribers
      : null;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const cancelledThisMonthRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(gte(subscriptions.cancelledAt, monthStart));
  const cancelledThisMonth = cancelledThisMonthRow[0]?.count ?? 0;
  const churnRatePct =
    activeSubscribers + cancelledThisMonth > 0
      ? Math.round(
          (cancelledThisMonth / (activeSubscribers + cancelledThisMonth)) * 1000
        ) / 10
      : null;

  const planCounts = new Map<string, number>();
  for (const s of activeSubs) {
    planCounts.set(s.plan, (planCounts.get(s.plan) ?? 0) + 1);
  }
  const planDistribution = Array.from(planCounts.entries()).map(
    ([plan, count]) => ({ plan, count })
  );

  const recentPaymentsRows = await db
    .select({
      userId: payments.userId,
      name: users.name,
      plan: payments.plan,
      amountCents: payments.amount,
      createdAt: payments.createdAt
    })
    .from(payments)
    .leftJoin(users, eq(users.id, payments.userId))
    .orderBy(desc(payments.createdAt))
    .limit(5);
  const recentPayments = recentPaymentsRows.map(r => ({
    userId: r.userId,
    name: r.name ?? 'Unknown',
    plan: r.plan,
    amountCents: r.amountCents,
    createdAt: r.createdAt
  }));

  // "new" from createdAt, "cancelled" from cancelledAt - both real counts.
  // cancelledAt only exists going forward from when this column shipped, so
  // historical months show 0 cancelled even if churn actually happened then.
  const growthRows = await db
    .select({
      month: sql<string>`strftime('%Y-%m', ${subscriptions.createdAt}, 'unixepoch')`,
      count: sql<number>`count(*)`
    })
    .from(subscriptions)
    .groupBy(sql`strftime('%Y-%m', ${subscriptions.createdAt}, 'unixepoch')`);

  const cancelledRows = await db
    .select({
      month: sql<string>`strftime('%Y-%m', ${subscriptions.cancelledAt}, 'unixepoch')`,
      count: sql<number>`count(*)`
    })
    .from(subscriptions)
    .where(sql`${subscriptions.cancelledAt} IS NOT NULL`)
    .groupBy(sql`strftime('%Y-%m', ${subscriptions.cancelledAt}, 'unixepoch')`);

  const months = last12Months(now);
  const newByMonth = new Map(growthRows.map(r => [r.month, r.count]));
  const cancelledByMonth = new Map(cancelledRows.map(r => [r.month, r.count]));
  const subscriberGrowth = months.map(month => ({
    month,
    new: newByMonth.get(month) ?? 0,
    cancelled: cancelledByMonth.get(month) ?? 0
  }));

  // One-time/credits refunds only - subscription refunds have no persisted
  // record (see stripe-refund.server.ts's handleSubscriptionRefundFallback
  // comment). Known undercount, not a bug.
  const refundsRows = await db
    .select({ amount: purchases.amount })
    .from(purchases)
    .where(gte(purchases.refundedAt, monthStart));
  const refundsCount = refundsRows.length;
  const refundsAmountCents = refundsRows.reduce((sum, r) => sum + r.amount, 0);

  return {
    overview: {
      mrrCents,
      mrrDeltaCents,
      activeSubscribers,
      activeSubscribersDelta,
      trialsActive,
      churnRatePct
    },
    revenue: {
      mrrCents,
      mrrDeltaCents,
      arpuCents,
      refundsCount,
      refundsAmountCents
    },
    mrrTrend,
    planDistribution,
    recentPayments,
    subscriberGrowth
  };
};
