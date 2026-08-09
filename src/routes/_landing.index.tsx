import { createFileRoute, redirect } from '@tanstack/react-router';
import { LandingPage } from '@/components/landing/landing-page';
import { config } from '@/config';
import { PATHS } from '@/lib/constants';
import { hasSessionCookie } from '@/lib/has-session-cookie';
import { getJsonLd, getSeoMeta, stringifyJsonLd } from '@/lib/seo';
import { setLandingPageCacheHeader } from '@/lib/ssr-cache-headers';
import { bootstrapQueryOptions } from '@/server/functions';

export const Route = createFileRoute('/_landing/')({
  beforeLoad: async ({ context }) => {
    // Only cache the anonymous response - setting this before the redirect
    // check below let a logged-in user's 302-to-/dashboard response carry
    // the same public, 24h-cacheable header, which a shared cache without
    // `Vary: Cookie` could then serve to every subsequent anonymous visitor.
    if (!(await hasSessionCookie())) {
      await setLandingPageCacheHeader();
      return;
    }
    const result = await context.queryClient.ensureQueryData(
      bootstrapQueryOptions
    );
    if (result.ok && result.data.user) {
      if (!result.data.onboardingComplete) {
        throw redirect({ to: PATHS.ONBOARDING });
      }
      throw redirect({ to: PATHS.DASHBOARD });
    }
    await setLandingPageCacheHeader();
  },
  component: LandingIndex,
  head: () => {
    const jsonLd = getJsonLd({
      type: 'SoftwareApplication',
      name: config.appName,
      description: config.seo.defaultDescription,
      url: `https://${config.domainName}`
    });
    return {
      meta: getSeoMeta({
        title: config.seo.defaultTitle,
        description: config.seo.defaultDescription,
        url: `https://${config.domainName}`
      }),
      links: [{ rel: 'canonical', href: `https://${config.domainName}` }],
      scripts: [
        { type: 'application/ld+json', children: stringifyJsonLd(jsonLd) }
      ]
    };
  }
});

function LandingIndex() {
  return <LandingPage />;
}
