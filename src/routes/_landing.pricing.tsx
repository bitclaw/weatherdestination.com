import { createFileRoute } from '@tanstack/react-router';
import { LandingFaq } from '@/components/landing/landing-faq';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { AnimateIn } from '@/components/ui/animate-in';
import { config } from '@/config';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

export const Route = createFileRoute('/_landing/pricing')({
  beforeLoad: setPublicPageCacheHeader,
  head: () => ({
    meta: getSeoMeta({
      title: `Pricing - ${config.appName}`,
      description:
        'Simple, transparent pricing. Start free, upgrade when you need to.',
      url: `https://${config.domainName}/pricing`
    })
  }),
  component: PricingPage
});

function PricingPage() {
  return (
    <div className="bg-background min-h-screen">
      <LandingNavbar />
      <main className="pt-16">
        <AnimateIn className="px-6 pt-16 pb-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
            No hidden fees. Simple plans, upgrade anytime.
          </p>
        </AnimateIn>
        <LandingPricing />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}
