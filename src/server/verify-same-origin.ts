// Origin check for cookie-authenticated src/routes/api/** handlers, which
// src/start.ts's csrfMiddleware does NOT cover - its filter is
// `handlerType === 'serverFn'` only, deliberately, since widening it to
// 'router' would also gate better-auth's own /api/auth/$ catch-all (OAuth
// callback redirects are cross-site top-level navigations by nature and
// would break under a same-origin check with no exemption). Apply this
// directly inside any API route handler that reads the session cookie and
// performs a state-changing or resource-consuming action - SameSite=Lax
// blocks cross-*site* requests, but not cross-*origin-same-site* ones (a
// subdomain, or an XSS'd sibling app on the same registrable domain).
//
// Mirrors the same precedence TanStack Start's own createCsrfMiddleware
// uses: Sec-Fetch-Site first, then Origin, then Referer.
export function isSameOriginRequest(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;

  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite !== null) return fetchSite === 'same-origin';

  const origin = request.headers.get('Origin');
  if (origin !== null) return origin === requestOrigin;

  const referer = request.headers.get('Referer');
  if (referer === null) return false;
  try {
    return new URL(referer).origin === requestOrigin;
  } catch {
    return false;
  }
}
