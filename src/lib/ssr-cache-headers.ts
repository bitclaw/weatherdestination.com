import { createIsomorphicFn } from '@tanstack/react-start';

// Single source of truth for the landing/public page Cache-Control value -
// server/start.ts imports this same constant for the prerendered `/` fast
// path (Bun.file(), bypassing this isomorphic fn entirely), so there's
// exactly one literal to change instead of two copies that happen to match.
//
// Cache-purge-on-deploy relies on a correctly-scoped CF_API_TOKEN, which can
// fail silently (wrong zone/missing Cache Purge permission). Keep the edge
// staleness window short so a missed purge self-heals in ~1h instead of
// lingering up to 8 days with dead asset-hash references baked into the
// cached HTML.
//
// stale-while-revalidate tightened from 24h to 5 minutes on 2026-08-15 after
// a real warpkit.dev incident (sibling product, built from the same
// template): a user's browser loaded a stale pre-deploy /login page via this
// same header, referencing a deleted JS bundle, which then broke navigating
// into the dashboard - a live black-screen crash, not just a crawler-visible
// 404. See warpkit.dev's docs/warpkit.dev/broken-js-stale-asset-hash.md for
// the full incident writeup and the platform-side purge-on-deploy fix (a
// missing CF_ZONE_ID in runmist/runmist's deploy env-builder) that
// accompanied it. This SWR value is the accepted fallback exposure for a
// *failed* purge now, not the primary defense.
export const LANDING_PAGE_CACHE_CONTROL =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=300';

export const setPublicPageCacheHeader = createIsomorphicFn()
  .server(async () => {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', LANDING_PAGE_CACHE_CONTROL);
  })
  .client(() => {});

export const setLandingPageCacheHeader = createIsomorphicFn()
  .server(async () => {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', LANDING_PAGE_CACHE_CONTROL);
  })
  .client(() => {});

// /login and /signup are the entry gate into every dashboard session - no
// meaningful origin-load benefit to caching them, only downside: a stale
// cached copy loads a deleted JS bundle and breaks on first SPA navigation
// into the dashboard (the 2026-08-15 incident, see above). Never edge-cache
// these pages, full stop - both the SSR path (_auth.tsx) and the prerendered
// fast path (server/start.ts's PRERENDERED map) must use this same constant
// so they can't drift apart the way they did before this fix (that drift -
// auth pages scoped out via one path but not the other - is exactly what
// caused the incident).
export const AUTH_PAGE_CACHE_CONTROL = 'no-store';

export const setAuthPageCacheHeader = createIsomorphicFn()
  .server(async () => {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', AUTH_PAGE_CACHE_CONTROL);
  })
  .client(() => {});
