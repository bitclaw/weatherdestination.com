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

## Non-HTML server routes: robots.txt and sitemap.xml

`/robots.txt` and `/sitemap.xml` (`src/routes/robots[.]txt.ts`,
`sitemap[.]xml.ts`) are prerendered too, but they're **server routes** -
`server.handlers.GET` with no `component` - not HTML pages, so they don't fit
the `PRERENDERED`/`prerenderedIndexHtml` mechanism described above:

- `autoStaticPathsDiscovery` (the mechanism that finds prerender candidates
  automatically) only walks routes with a `component` prop
  (`prerender-routes-plugin.ts` in `@tanstack/start-plugin-core`). A route
  with no component - any server-only route - is invisible to it, so it must
  be added to an explicit `pages` array in `vite.config.ts`'s
  `tanstackStart({...})` options (a sibling of `prerender`, not nested
  inside it), in addition to `filter` (which still gates explicitly-listed
  pages too):
  ```ts
  pages: [
    { path: '/robots.txt', prerender: { enabled: true } },
    { path: '/sitemap.xml', prerender: { enabled: true } }
  ]
  ```
- Because their responses aren't `text/html`, the prerender crawler writes
  them to the literal output path (`dist/client/robots.txt`,
  `dist/client/sitemap.xml`), not `<path>/index.html` - see `isImplicitHTML`
  in `@tanstack/start-plugin-core`'s `prerender.ts`. That means they're
  served by `server/start.ts`'s **generic static-asset branch**
  (MIME-by-extension), not the `PRERENDERED` map - the `PRERENDERED` map's
  hardcoded `Content-Type: text/html` would be wrong for these.
- The static-asset branch's default `Cache-Control` for non-hashed files is
  `public, max-age=0, must-revalidate`. A small `SEO_CACHE_CONTROL` override
  in `server/start.ts` preserves the longer TTLs
  (`/robots.txt` → 86400s, `/sitemap.xml` → 3600s) the routes themselves set
  when SSR-rendered.
- The route files stay (they're not deleted) - `bun run dev` still serves
  them live via SSR, since prerendering only runs on `vite build`. Only
  production gets the prerendered fast path. Their actual content-building
  logic lives in `src/lib/seo-static.ts` (`buildRobotsTxt`, `buildSitemapXml`)
  so it's unit-testable and shared between the route handler and its test.

This exists because both routes originally ran the full SSR pipeline on
every request, including crawler hits - slow enough on a cold origin to
time out Ahrefs's crawler against a live deployment (see warpkit.dev, the
sibling product built from the same template, where this was first caught).

## What this is not

There's no revalidate-on-interval primitive (no ISR). Prerendered HTML goes
stale only on the next deploy, which is correct for git-backed content
(`content-collections` blog posts, static marketing copy) but means a CMS
with an independent publish cadence would need its own webhook-triggered
rebuild , nothing here does that automatically. See
[docs/warpkit/performance.md](../performance.md) for the load-test numbers
this trades against `ssr: 'data-only'` and full SSR.
