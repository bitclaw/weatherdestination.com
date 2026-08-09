import { useSuspenseQuery } from '@tanstack/react-query';
import { CreditCard, TrendingDown, TrendingUp, Users } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminAnalyticsQueryOptions } from '@/features/admin';
import { MrrChart } from './mrr-chart';
import { PlanDistribution } from './plan-distribution';
import { RecentPayments } from './recent-payments';
import { SubscriberGrowthChart } from './subscriber-growth-chart';

const formatCents = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const formatDelta = (delta: number | null, formatFn: (n: number) => string) => {
  if (delta === null) return 'No prior month data yet';
  if (delta === 0) return 'No change from last month';
  const sign = delta > 0 ? '+' : '-';
  return `${sign}${formatFn(Math.abs(delta))} from last month`;
};

export function AdminAnalyticsPage() {
  const { data: analytics } = useSuspenseQuery(adminAnalyticsQueryOptions);

  if (!analytics) {
    return (
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        </div>
      </div>
    );
  }

  const { overview, revenue, planDistribution } = analytics;

  const overviewStats = [
    {
      title: 'MRR',
      value: formatCents(overview.mrrCents),
      delta: formatDelta(overview.mrrDeltaCents, formatCents),
      positive: (overview.mrrDeltaCents ?? 0) >= 0,
      icon: CreditCard
    },
    {
      title: 'Active Subscribers',
      value: String(overview.activeSubscribers),
      delta: formatDelta(overview.activeSubscribersDelta, n => String(n)),
      positive: (overview.activeSubscribersDelta ?? 0) >= 0,
      icon: Users
    },
    {
      title: 'Trials Active',
      value: String(overview.trialsActive),
      delta: 'Current count',
      positive: true,
      icon: TrendingUp
    },
    {
      title: 'Churn Rate',
      value: overview.churnRatePct === null ? '—' : `${overview.churnRatePct}%`,
      delta: 'Cancelled this month / total',
      positive: (overview.churnRatePct ?? 0) < 5,
      icon: TrendingDown
    }
  ];

  const revenueStats = [
    {
      title: 'MRR',
      value: formatCents(revenue.mrrCents),
      delta: formatDelta(revenue.mrrDeltaCents, formatCents),
      positive: (revenue.mrrDeltaCents ?? 0) >= 0,
      icon: CreditCard
    },
    {
      title: 'ARPU',
      value: formatCents(revenue.arpuCents),
      delta: 'Avg. revenue per active subscriber',
      positive: true,
      icon: TrendingUp
    },
    {
      title: 'Refunds',
      value: String(revenue.refundsCount),
      delta: `${formatCents(revenue.refundsAmountCents)} this month (one-time/credits only)`,
      positive: revenue.refundsCount === 0,
      icon: TrendingDown
    },
    {
      title: 'Active Subscribers',
      value: String(overview.activeSubscribers),
      delta: formatDelta(overview.activeSubscribersDelta, n => String(n)),
      positive: (overview.activeSubscribersDelta ?? 0) >= 0,
      icon: Users
    }
  ];

  const totalPlanUsers = planDistribution.reduce((s, p) => s + p.count, 0);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Business metrics for your SaaS.
        </p>
      </div>

      <Tabs className="space-y-4" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────── */}
        <TabsContent className="space-y-4" value="overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {overviewStats.map(stat => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {stat.title}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">
                      {stat.delta}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
            <Card className="col-span-1 lg:col-span-4">
              <CardHeader>
                <CardTitle>Subscriber Growth</CardTitle>
                <CardDescription>
                  New vs cancelled subscriptions by month
                </CardDescription>
              </CardHeader>
              <CardContent className="ps-2">
                <SubscriberGrowthChart data={analytics.subscriberGrowth} />
              </CardContent>
            </Card>
            <Card className="col-span-1 lg:col-span-3">
              <CardHeader>
                <CardTitle>Plan Distribution</CardTitle>
                <CardDescription>Users by subscription tier</CardDescription>
              </CardHeader>
              <CardContent>
                <PlanDistribution data={planDistribution} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Revenue ───────────────────────────────────────────────── */}
        <TabsContent className="space-y-4" value="revenue">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {revenueStats.map(stat => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {stat.title}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">
                      {stat.delta}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
            <Card className="col-span-1 lg:col-span-4">
              <CardHeader>
                <CardTitle>MRR Trend</CardTitle>
                <CardDescription>
                  Monthly recurring revenue, tracked forward from when this
                  dashboard shipped
                </CardDescription>
              </CardHeader>
              <CardContent className="ps-2">
                <MrrChart data={analytics.mrrTrend} />
              </CardContent>
            </Card>
            <Card className="col-span-1 lg:col-span-3">
              <CardHeader>
                <CardTitle>Recent Payments</CardTitle>
                <CardDescription>
                  Latest successful subscription invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecentPayments payments={analytics.recentPayments} />
              </CardContent>
            </Card>
          </div>

          {/* Plan revenue breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Plan</CardTitle>
              <CardDescription>Active subscribers per tier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {planDistribution.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No active subscribers yet.
                </p>
              )}
              {planDistribution.map(p => {
                const pct =
                  totalPlanUsers > 0
                    ? Math.round((p.count / totalPlanUsers) * 100)
                    : 0;
                return (
                  <div className="space-y-1.5" key={p.plan}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{p.plan}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {p.count} subscriber{p.count === 1 ? '' : 's'} ({pct}
                        %)
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
