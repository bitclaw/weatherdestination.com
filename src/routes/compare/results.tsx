import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LeadForm } from '@/components/landing/lead-form';
import { Button } from '@/components/ui/button';
import { config } from '@/config';
import { cityComparisonQueryOptions } from '@/features/weather';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

const searchSchema = z.object({
  city: z.array(z.string()).min(2).max(5)
});

export const Route = createFileRoute('/compare/results')({
  validateSearch: searchSchema,
  beforeLoad: setPublicPageCacheHeader,
  loaderDeps: ({ search }) => ({ city: search.city }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(
      cityComparisonQueryOptions(deps.city)
    );
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

function CompareResults() {
  const { city } = Route.useSearch();
  const { data: cities } = useSuspenseQuery(cityComparisonQueryOptions(city));

  return (
    <div className="min-h-screen">
      <LandingNavbar />
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

        <section className="border-border bg-muted/30 mb-12 rounded-lg border p-6">
          <h2 className="text-foreground mb-2 text-xl font-bold">
            Want the full report?
          </h2>
          <p className="text-muted-foreground mb-4 text-sm">
            We're building detailed, downloadable relocation reports. Leave your
            email to get notified when they launch.
          </p>
          <LeadForm buttonText="Notify me" />
        </section>

        <div className="flex gap-4">
          <Button asChild size="lg" variant="outline">
            <Link to="/compare">Compare different cities</Link>
          </Button>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
