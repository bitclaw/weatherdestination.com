// Single source of truth for the flat list of exact-match static paths
// prerendered to HTML - shared between vite.config.ts's `prerender.filter`
// (what gets rendered to disk at build time) and server/start.ts's
// `PRERENDERED` map (what gets served off disk instead of hitting SSR).
// A path in one but not the other used to fail silently (falls through to
// full SSR every request, not a build error) - exactly the class of bug
// that broke robots.txt/sitemap.xml, see CLAUDE.md's Server Boot Side
// Effects section.
//
// Deliberately excludes /blog/* - discovered dynamically from
// content-collections data (allPosts) in both files already, never
// hand-listed, so it was never the drift risk. This repo has no docs
// collection, unlike warpkit.dev.
export const STATIC_HTML_PATHS = [
  '/',
  '/pricing',
  '/features',
  '/changelog',
  '/contact',
  '/privacy',
  '/tos',
  '/login',
  '/signup',
  '/blog'
] as const;

// robots.txt/sitemap.xml are prerendered server routes (no `component`,
// see vite.config.ts's `pages` array), not HTML - kept separate from
// STATIC_HTML_PATHS since they need their own `pages` entries and land in
// server/start.ts's static-asset branch, not the PRERENDERED map.
export const NON_HTML_PRERENDERED_PATHS = [
  '/robots.txt',
  '/sitemap.xml'
] as const;
