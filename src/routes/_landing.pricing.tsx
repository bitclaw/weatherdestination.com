import { createFileRoute, Link } from '@tanstack/react-router';
import { LandingFaq } from '@/components/landing/landing-faq';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LeadForm } from '@/components/landing/lead-form';
import { AnimateIn } from '@/components/ui/animate-in';
import { Button } from '@/components/ui/button';
import { config } from '@/config';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

export const Route = createFileRoute('/_landing/pricing')({
  beforeLoad: setPublicPageCacheHeader,
  head: () => ({
    meta: getSeoMeta({
      title: `Pricing - ${config.appName}`,
      description:
        'City comparison is free. No hidden fees, no account needed.',
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
            Free, for now
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
            City comparison is free and doesn't require an account. We're
            considering a paid, more detailed relocation report: leave your
            email if you'd want one.
          </p>
          <div className="mt-8 flex flex-col items-center gap-6">
            <Button asChild size="lg">
              <Link to="/compare">Compare cities</Link>
            </Button>
            <div className="w-full max-w-sm">
              <LeadForm buttonText="Notify me about paid reports" />
            </div>
          </div>
        </AnimateIn>
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}
