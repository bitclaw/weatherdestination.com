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
export const LANDING_PAGE_CACHE_CONTROL =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

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
