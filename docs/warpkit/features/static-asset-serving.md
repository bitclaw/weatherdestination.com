# Static Asset Serving

`server/start.ts` builds its `Bun.serve({ routes: {...} })` table at boot from two
sources - `server/static-assets.ts`'s boot-time glob of `dist/client/`, and the
`PRERENDERED` map (see [static-prerendering.md](static-prerendering.md)) - and serves
every eligible file with ETag/304 support, gzip compression, and in-memory preloading.
This doc covers the serving layer; static-prerendering.md covers what gets built.

## Why a route table instead of a single `fetch()` handler

Previously `server/start.ts` had one `fetch(request)` function doing sequential
`if`/`else` checks (PRERENDERED map, then a generic static-asset branch, then SSR
fallback). It now registers one `Bun.serve()` route per servable path instead - same
behavior, more readable, and it removes the old request-time path-traversal guard
entirely: every servable path was discovered from a real directory glob at boot, so
the route table itself is the allowlist. Nothing resolves a request-supplied pathname
against the filesystem at request time anymore.

Two response-header policies exist, not three - despite three route categories
(prerendered HTML, static assets, SSR fallback):

- **Fast-path** (`withFastPathSecurityHeaders` in `server/start.ts`): prerendered HTML
  with no session cookie, and every static asset. Always `isProduction=true` -
  these only exist once a real build has run, so there's nothing to relax for local dev.
- **SSR-delegated** (`deliverSsrResponse`): the wildcard `'/*'` fallback, and a
  prerendered route's handler when a session cookie *is* present (so `beforeLoad` can
  run a real redirect). Uses `process.env.NODE_ENV === 'production'`, matching
  `securityMiddleware`'s dev-mode CSP relaxation. A single prerendered route can
  produce either kind of response depending on the request - the header policy is
  chosen per response, not fixed per route.

The wildcard `'/*'` entry is a plain handler, not method-scoped (`{ GET: ... }`) -
server functions (`POST`), and any other HTTP method, all need to reach real SSR, not
just `GET` requests to unmatched paths.

There's also a `'/assets/*'` catch entry above the `'/*'` wildcard, returning a plain
404 with no headers, for the same reason it existed in the pre-refactor code: a missing
hashed asset (deleted old release, stale cached HTML referencing a chunk that no longer
exists) must 404, not fall through to SSR and return the SPA document with a 200 - a
browser dynamic-import expecting JS and getting HTML back throws a confusing generic
error instead of the clean "Failed to fetch dynamically imported module" one. Registered
literal `/assets/*.js` routes (from the boot-time glob) take priority over this pattern
for files that actually exist; only a missing one falls through to it.

## ETag / conditional 304

Every preloaded asset gets a weak ETag (`Bun.hash` over the raw bytes) computed once
at boot. A repeat request with a matching `if-none-match` gets a `304` - still with
full security headers, the same as any other response leaving this process. `Bun.hash`
is deterministic across processes, so an ETag computed by one `cluster.ts` worker
stays valid when a client's conditional request lands on a different worker.

## Gzip

Compressible MIME types (`text/*`, `application/javascript`, `application/json`,
`application/xml`, `image/svg+xml`) over a minimum size get a gzip variant
precomputed at boot, served when the request's `Accept-Encoding` includes `gzip`.
`Vary: Accept-Encoding` is set whenever a gzip variant exists, regardless of whether
this particular request used it - without it, an intermediary cache could serve the
wrong encoding to a client that didn't ask for it.

## In-memory preloading

Files at or under `ASSET_PRELOAD_MAX_SIZE` are read into memory once at boot (with
their ETag/gzip variant, if applicable); anything larger is served on-demand via
`Bun.file()` per request, with no ETag or gzip.

**Startup cost**: reading, gzipping, and hashing every preloadable file happens
concurrently (`Promise.all`, not a sequential loop) but is still real CPU-bound work
(gzip/hash don't parallelize just because the surrounding `async` functions do, on a
single JS thread) - accepted as a one-time per-process cost, not optimized further
(e.g. via lazy background population) given this app's small total asset footprint.

## Config (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `ASSET_PRELOAD_MAX_SIZE` | `5242880` (5MB) | Files at or under this size preload into memory; larger files are served on-demand from disk |
| `ASSET_PRELOAD_ENABLE_ETAG` | `true` | Toggle ETag/304 support |
| `ASSET_PRELOAD_ENABLE_GZIP` | `true` | Toggle gzip precompression |
| `ASSET_PRELOAD_GZIP_MIN_SIZE` | `1024` (1KB) | Minimum size for gzip to be worth it |

## Adapted from, not copied from, TanStack's reference server

The preload/ETag/gzip mechanism is adapted from TanStack Router's own
`examples/react/start-bun/server.ts` ("Production Server with Bun"). That reference is
not usable as-is here: it has no clean-URL → `index.html` mapping (would regress every
prerendered page back to full SSR on every request), no auth-cookie-aware routing (this
app's `/login`+session-cookie SSR bypass is custom), and no security headers or boot
side-effect hooks at all. Only the preload/ETag/gzip strategy was pulled in;
`server/start.ts` still owns everything the reference doesn't have.

## Known, intentional quirks preserved from before this change

- **Literal `*.html` paths bypass the auth-cookie check.** `PRERENDERED` maps clean
  URLs (`/pricing`) to files; a direct request for the literal path
  (`/pricing/index.html`) was never in `PRERENDERED` and is served by the generic
  static-asset route instead, with no cookie check. This means `/login/index.html`
  requested directly bypasses the SSR-redirect-for-logged-in-users logic. Pre-existing,
  not something this refactor fixed or should silently change.
- **`.html` has no MIME table entry.** A literal `*.html` path gets
  `application/octet-stream`, not `text/html`, for the same reason - it was never a
  `PRERENDERED` entry (those hardcode `text/html; charset=utf-8` directly), just a file
  the generic MIME-by-extension lookup doesn't cover.
