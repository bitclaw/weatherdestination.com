import { createFileRoute } from '@tanstack/react-router';
import { LandingFeatures } from '@/components/landing/landing-features';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { AnimateIn } from '@/components/ui/animate-in';
import { config } from '@/config';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

export const Route = createFileRoute('/_landing/features')({
  beforeLoad: setPublicPageCacheHeader,
  head: () => ({
    meta: getSeoMeta({
      title: `Features - ${config.appName}`,
      description: `Everything you need to ship your SaaS. See what's included in ${config.appName}.`,
      url: `https://${config.domainName}/features`
    })
  }),
  component: FeaturesPage
});

function FeaturesPage() {
  return (
    <div className="bg-background min-h-screen">
      <LandingNavbar />
      <main className="pt-16">
        <AnimateIn className="px-6 pt-16 pb-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Everything you need to ship
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
            Auth, billing, emails, per-user databases , all wired up and ready
            to go.
          </p>
        </AnimateIn>
        <LandingFeatures />
      </main>
      <LandingFooter />
    </div>
  );
}
