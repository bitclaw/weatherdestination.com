import { createFileRoute } from '@tanstack/react-router';

// Polled by use-update-available.ts to detect a newer build than the one
// that rendered the current session's app shell. VITE_BUILD_ID is baked in
// at build time (see vite.config.ts) - identical for the client bundle and
// this SSR route within a single build, so no runtime env var plumbing is
// needed. Public, cheap, no DB/auth - same spirit as /healthcheck.
//
// Cache-Control: response is identical for every caller until the next
// build, so it's safe to cache even though every real caller is
// authenticated (the endpoint's own response has no per-user data, unlike
// the page that called it). Collapses same-browser multi-tab polling into
// one origin hit via the browser's own HTTP cache - fetch() already
// respects Cache-Control by default. Production-only: a 60s cache in dev
// would mask a rebuild for up to a minute per tab during iteration.
export const Route = createFileRoute('/api/version')({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { buildId: import.meta.env.VITE_BUILD_ID ?? 'dev' },
          {
            headers:
              process.env.NODE_ENV === 'production'
                ? { 'Cache-Control': 'public, max-age=60' }
                : {}
          }
        )
    }
  }
});
