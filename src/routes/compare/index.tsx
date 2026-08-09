import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { config } from '@/config';
import { citiesQueryOptions } from '@/features/weather';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

export const Route = createFileRoute('/compare/')({
  beforeLoad: setPublicPageCacheHeader,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(citiesQueryOptions);
  },
  head: () => ({
    meta: getSeoMeta({
      title: `Compare Cities - ${config.appName}`,
      description:
        'Compare climate risk and weather data across multiple cities to find your best-fit destination.',
      url: `https://${config.domainName}/compare`
    }),
    links: [{ rel: 'canonical', href: `https://${config.domainName}/compare` }]
  }),
  component: CompareIndex
});

function CompareIndex() {
  const { data: cities } = useSuspenseQuery(citiesQueryOptions);
  const [selected, setSelected] = useState<string[]>([]);
  const navigate = useNavigate();

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : prev.length < 5
          ? [...prev, id]
          : prev
    );
  };

  const submit = () => {
    if (selected.length < 2) return;
    navigate({
      to: '/compare/results',
      search: { city: selected }
    });
  };

  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <main className="mx-auto max-w-4xl px-6 py-16 pt-28">
        <h1 className="text-4xl font-bold tracking-tight">Compare cities</h1>
        <p className="text-muted-foreground mt-2">
          Pick 2 to 5 cities to compare climate risk, sunshine, and quality of
          life.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cities.map(city => (
            <label
              className="border-border hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm"
              htmlFor={`city-${city.id}`}
              key={city.id}
            >
              <Checkbox
                checked={selected.includes(city.id)}
                disabled={!selected.includes(city.id) && selected.length >= 5}
                id={`city-${city.id}`}
                onCheckedChange={() => toggle(city.id)}
              />
              <span>
                {city.name}, {city.stateCode}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-4">
          <Button disabled={selected.length < 2} onClick={submit} size="lg">
            Compare {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
          <p className="text-muted-foreground text-sm">
            Select at least 2, up to 5.
          </p>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
