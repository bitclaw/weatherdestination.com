import { lazy, Suspense } from 'react';
import { LandingHero } from './landing-hero';
import { LandingNavbar } from './landing-navbar';
import { LandingSectionSkeleton } from './landing-section-skeleton';
import { LandingSocialProof } from './landing-social-proof';

// Lazy: below-the-fold sections shouldn't block initial JS parse/hydrate.
// Heights are best-effort estimates matched to each section's typical
// rendered size (not one shared guess) so a fallback that's briefly visible
// on a slow connection doesn't cause a layout shift - refine via visual QA
// if any section's skeleton is noticeably off from its real content.
const LandingProblem = lazy(() =>
  import('./landing-problem').then(m => ({ default: m.LandingProblem }))
);
const LandingWithWithout = lazy(() =>
  import('./landing-with-without').then(m => ({
    default: m.LandingWithWithout
  }))
);
const LandingFeatures = lazy(() =>
  import('./landing-features').then(m => ({ default: m.LandingFeatures }))
);
const LandingTestimonials = lazy(() =>
  import('./landing-testimonials').then(m => ({
    default: m.LandingTestimonials
  }))
);
const LandingPricing = lazy(() =>
  import('./landing-pricing').then(m => ({ default: m.LandingPricing }))
);
const LandingFaq = lazy(() =>
  import('./landing-faq').then(m => ({ default: m.LandingFaq }))
);
const LandingCta = lazy(() =>
  import('./landing-cta').then(m => ({ default: m.LandingCta }))
);
const LandingFooter = lazy(() =>
  import('./landing-footer').then(m => ({ default: m.LandingFooter }))
);

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingSocialProof />
        <Suspense fallback={<LandingSectionSkeleton height={450} />}>
          <LandingProblem />
        </Suspense>
        <Suspense fallback={<LandingSectionSkeleton height={500} />}>
          <LandingWithWithout />
        </Suspense>
        <Suspense fallback={<LandingSectionSkeleton height={550} />}>
          <LandingFeatures />
        </Suspense>
        <Suspense fallback={<LandingSectionSkeleton height={600} />}>
          <LandingTestimonials />
        </Suspense>
        <Suspense fallback={<LandingSectionSkeleton height={700} />}>
          <LandingPricing />
        </Suspense>
        <Suspense fallback={<LandingSectionSkeleton height={650} />}>
          <LandingFaq />
        </Suspense>
        <Suspense fallback={<LandingSectionSkeleton height={300} />}>
          <LandingCta />
        </Suspense>
      </main>
      <Suspense fallback={<LandingSectionSkeleton height={400} />}>
        <LandingFooter />
      </Suspense>
    </div>
  );
}
