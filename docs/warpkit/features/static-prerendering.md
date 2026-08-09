# Static Prerendering

Public, non-personalized pages are rendered to static HTML once at build time
and served straight off disk , zero React render cost per request, zero
database hit, faster than even `ssr: 'data-only'`. Currently covers `/`,
`/pricing`, `/features`, `/changelog`, `/privacy`, `/tos`, `/login`,
`/signup`, `/blog`, and every `/blog/:slug` post.

## How it works

Two pieces have to agree, and both live outside `src/`:

**1. `vite.config.ts`** , the `tanstackStart({ prerender: {...} })` option
tells the build which routes to render to HTML:

```ts
prerender: {
  enabled: true,
  filter: page =>
    page.path === '/' ||
    page.path === '/pricing' ||
    // ...one entry per static page
    page.path.startsWith('/blog/'),
  crawlLinks: true // discovers /blog/$slug posts by parsing <a href> out of the rendered /blog index
}
```

`filter` is an **allowlist**, not a denylist. TanStack's router-generator
auto-discovers every route with no `$param` segment as a *candidate*
(dashboard pages included), but `filter` is what actually decides which
candidates get rendered. Never loosen this to something permissive like "any
route outside `_app`" , it only takes one future auth-gated static-shaped
route to leak personalized HTML into a build artifact served to everyone.

`crawlLinks: true` means blog posts don't need a hand-maintained slug list:
the prerenderer fetches `/blog`, parses the post links out of the rendered
HTML, and queues each discovered `/blog/:slug` for prerendering too.

**2. `server/start.ts`** , the production entry point checks incoming
requests against a `PRERENDERED` map before the request ever reaches the SSR
handler:

```ts
const PRERENDERED: Record<string, string> = {
  '/': path.join(distClient, 'index.html'),
  '/pricing': prerenderedIndexHtml('pricing'),
  // ...
  ...Object.fromEntries(
    allPosts.map(post => [`/blog/${post.slug}`, prerenderedIndexHtml(`blog/${post.slug}`)])
  )
};
```

Blog entries are derived from `allPosts` (the same `content-collections`
source `crawlLinks` discovers pages from), not hand-listed , the map can't
drift from what the blog actually contains. A matching request with no
session cookie gets `Bun.file(htmlPath)` directly; everything else (a path
not in the map, or a request carrying a session cookie) falls through to the
normal SSR handler.

## Why authenticated requests always bypass it

Every prerendered path is served through the same cookie check. `/`, `/login`,
and `/signup` genuinely need it: each has a `beforeLoad` that redirects an
already-logged-in visitor away (to `/dashboard`, or off `/login`/`/signup`
respectively) , the static HTML can't do that itself, so a request carrying a
session cookie must fall through to real SSR to get the redirect.
`_auth.tsx`'s `beforeLoad` gates that DB-backed check behind
`hasSessionCookie()` (`src/lib/has-session-cookie.ts`, shared with
`_landing.index.tsx`) the same way the homepage always has: skip the real
bootstrap/session lookup entirely for a visitor who obviously has no session,
only pay for it when a cookie is actually present. The other pages
(`/pricing`, `/blog`, etc.) have no session-dependent content at all, so
gating them through the same cookie check is free consistency, not a
separate mechanism to reason about.

## Adding a new page to the allowlist

1. Confirm the route has no auth-gated or per-user content , grep its route
   file for `beforeLoad`/`loader`/`requireUser`. If it reads anything from a
   session or the database on a per-visitor basis, it does not belong here.
2. Add the path to `filter` in `vite.config.ts`.
3. Add the matching entry to `PRERENDERED` in `server/start.ts` (use
   `prerenderedIndexHtml('your-path')` , the helper already assumes the
   `<path>/index.html` output layout every other entry uses).
4. `make build` and check the log for `[prerender] - /your-path`, then
   confirm `dist/client/your-path/index.html` exists.
5. Boot the built server (`make start`) and curl the route , a real page
   load, not a build-time crawl.

## What this is not

There's no revalidate-on-interval primitive (no ISR). Prerendered HTML goes
stale only on the next deploy, which is correct for git-backed content
(`content-collections` blog posts, static marketing copy) but means a CMS
with an independent publish cadence would need its own webhook-triggered
rebuild , nothing here does that automatically. See
[docs/warpkit/performance.md](../performance.md) for the load-test numbers
this trades against `ssr: 'data-only'` and full SSR.
