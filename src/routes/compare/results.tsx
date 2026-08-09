import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { CheckoutButton } from '@/components/landing/checkout-button';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { Button } from '@/components/ui/button';
import { config } from '@/config';
import {
  cityComparisonQueryOptions,
  combinedScore,
  reportAccessQueryOptions,
  sadRiskScore
} from '@/features/weather';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

const searchSchema = z.object({
  city: z.array(z.string()).min(2).max(5)
});

const reportPlan = config.stripe.plans.find(p => p.id === 'report');

export const Route = createFileRoute('/compare/results')({
  validateSearch: searchSchema,
  beforeLoad: setPublicPageCacheHeader,
  loaderDeps: ({ search }) => ({ city: search.city }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        cityComparisonQueryOptions(deps.city)
      ),
      context.queryClient.ensureQueryData(reportAccessQueryOptions)
    ]);
  },
  head: () => ({
    meta: getSeoMeta({
      title: `City Comparison - ${config.appName}`,
      description:
        'Side-by-side climate risk, sunshine, and quality of life comparison.'
    })
  }),
  component: CompareResults
});

function RiskBadge({ value }: { value: number }) {
  const level =
    value < 30 ? 'low' : value < 60 ? 'medium' : value < 80 ? 'high' : 'severe';
  const colors = {
    low: 'bg-green-100 text-green-800 border-green-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    severe: 'bg-red-100 text-red-800 border-red-300'
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[level]}`}
    >
      {value} / 100
    </span>
  );
}

function SunshineBadge({ hours }: { hours: number }) {
  const level =
    hours < 5 ? 'low' : hours < 7 ? 'medium' : hours < 9 ? 'good' : 'excellent';
  const colors = {
    low: 'bg-gray-100 text-gray-800 border-gray-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    good: 'bg-blue-100 text-blue-800 border-blue-300',
    excellent: 'bg-green-100 text-green-800 border-green-300'
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[level]}`}
    >
      {hours.toFixed(1)} hrs/day
    </span>
  );
}

function ScoreTeaser({
  score,
  topConcernLabel
}: {
  score: number;
  topConcernLabel: string;
}) {
  const level =
    score >= 75 ? 'good' : score >= 55 ? 'ok' : score >= 35 ? 'meh' : 'bad';
  const colors = {
    good: 'bg-green-100 text-green-800 border-green-300',
    ok: 'bg-blue-100 text-blue-800 border-blue-300',
    meh: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    bad: 'bg-red-100 text-red-800 border-red-300'
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[level]}`}
    >
      {score}/100 · main concern: {topConcernLabel}
    </span>
  );
}

function CompareResults() {
  const { city } = Route.useSearch();
  const { data: cities } = useSuspenseQuery(cityComparisonQueryOptions(city));
  const { data: hasReportAccess } = useSuspenseQuery(reportAccessQueryOptions);

  return (
    <div className="min-h-screen">
      <div className="print:hidden">
        <LandingNavbar />
      </div>
      <main className="mx-auto max-w-7xl px-4 py-12 pt-28">
        <div className="mb-8">
          <h1 className="text-foreground mb-4 text-4xl font-bold tracking-tight">
            City Comparison Results
          </h1>
          <p className="text-muted-foreground text-lg">
            Comparing {cities.length} cities for climate risk, sunshine, and
            quality of life.
          </p>
        </div>

        <section className="mb-12">
          <h2 className="text-foreground mb-6 text-2xl font-bold">
            Overall Safety &amp; Livability
          </h2>
          <div className="flex flex-wrap gap-4">
            {cities.map(c => {
              const { score, topConcern } = combinedScore(c);
              return (
                <div
                  className="border-border bg-card min-w-[220px] flex-1 rounded-lg border p-4"
                  key={c.id}
                >
                  <div className="font-medium">
                    {c.name}, {c.stateCode}
                  </div>
                  <div className="mt-2">
                    <ScoreTeaser
                      score={score}
                      topConcernLabel={topConcern.label}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            * Combined score out of 100 (higher is better), blending climate
            risk, seasonal depression risk, cost of living, and air quality. The
            full breakdown per city is in the detailed report below.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-foreground mb-6 text-2xl font-bold">
            Climate Risk Scores
          </h2>
          <div className="bg-card border-border overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      City
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Wildfire
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Flood
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Hurricane
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Heat Wave
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Drought
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((c, idx) => (
                    <tr
                      className={
                        idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                      }
                      key={c.id}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium">
                          {c.name}, {c.stateCode}
                        </div>
                        {c.population && (
                          <div className="text-muted-foreground text-sm">
                            Pop: {c.population.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <RiskBadge value={c.wildfireRisk} />
                      </td>
                      <td className="px-6 py-4">
                        <RiskBadge value={c.floodRisk} />
                      </td>
                      <td className="px-6 py-4">
                        <RiskBadge value={c.hurricaneRisk} />
                      </td>
                      <td className="px-6 py-4">
                        <RiskBadge value={c.heatWaveRisk} />
                      </td>
                      <td className="px-6 py-4">
                        <RiskBadge value={c.droughtRisk} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            * Risk scores range from 0-100, where higher values indicate greater
            risk
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-foreground mb-6 text-2xl font-bold">
            Weather & Quality of Life
          </h2>
          <div className="bg-card border-border overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      City
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Sunshine
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Cloud Cover
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Avg Temp
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Cost of Living
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Air Quality
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((c, idx) => (
                    <tr
                      className={
                        idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                      }
                      key={c.id}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium">
                          {c.name}, {c.stateCode}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <SunshineBadge hours={c.avgSunshineHours} />
                      </td>
                      <td className="px-6 py-4">
                        {c.avgCloudCover.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4">
                        {c.avgTempLow.toFixed(0)}°F - {c.avgTempHigh.toFixed(0)}
                        °F
                      </td>
                      <td className="px-6 py-4">
                        {c.costOfLivingIndex
                          ? c.costOfLivingIndex.toFixed(0)
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {c.airQualityIndex ?? 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            * Cost of Living: 100 = national average, higher = more expensive
            <br />* Air Quality Index (AQI): Lower is better, 0-50 = Good,
            51-100 = Moderate
          </p>
        </section>

        {hasReportAccess ? (
          <section className="mb-12">
            <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
              <h2 className="text-foreground text-2xl font-bold">
                Detailed Report
              </h2>
              <Button
                onClick={() => window.print()}
                size="sm"
                variant="outline"
              >
                Print report
              </Button>
            </div>
            <div className="space-y-6">
              {cities.map(c => {
                const { score, recommendation } = combinedScore(c);
                return (
                  <div
                    className="border-border bg-card rounded-lg border p-6"
                    key={c.id}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {c.name}, {c.stateCode}
                      </h3>
                      <span className="text-muted-foreground text-sm">
                        {score}/100
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{recommendation}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">Wildfire</dt>
                        <dd>{c.wildfireRisk}/100</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Flood</dt>
                        <dd>{c.floodRisk}/100</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Hurricane</dt>
                        <dd>{c.hurricaneRisk}/100</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Heat wave</dt>
                        <dd>{c.heatWaveRisk}/100</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Drought</dt>
                        <dd>{c.droughtRisk}/100</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          Seasonal depression risk
                        </dt>
                        <dd>{sadRiskScore(c)}/100</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
            <p className="text-muted-foreground mt-4 text-xs">
              Data ported from prior research, pending fresh NOAA verification -
              directionally accurate, not authoritative.
            </p>
          </section>
        ) : (
          <section className="border-border bg-muted/30 mb-12 rounded-lg border p-6 print:hidden">
            <h2 className="text-foreground mb-2 text-xl font-bold">
              Get the full report
            </h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Every scoring factor explained per city, a personalized
              recommendation, and a printable report. One-time purchase,
              lifetime access.
            </p>
            {reportPlan?.oneTime && (
              <CheckoutButton
                interval="monthly"
                mode="one_time"
                priceId={reportPlan.oneTime.priceId}
              >
                Get the report — ${reportPlan.oneTime.price}
              </CheckoutButton>
            )}
          </section>
        )}

        <div className="flex gap-4 print:hidden">
          <Button asChild size="lg" variant="outline">
            <Link to="/compare">Compare different cities</Link>
          </Button>
        </div>
      </main>
      <div className="print:hidden">
        <LandingFooter />
      </div>
    </div>
  );
}
