import { createIsomorphicFn } from '@tanstack/react-start';
import { SESSION_COOKIE_NAME } from '@/config';

// Extracted from _landing.index.tsx once a second route (_auth.tsx) needed
// the identical check: cheap presence test so a `beforeLoad` can skip a real
// bootstrap/session DB lookup for visitors who obviously have no session,
// without needing to know better-auth's actual cookie value or format.
export const hasSessionCookie = createIsomorphicFn()
  .server(async () => {
    const { getCookies } = await import('@tanstack/react-start/server');
    // better-auth prefixes the cookie with __Secure- in production (https
    // baseURL) - an exact SESSION_COOKIE_NAME lookup silently never matches
    // there, permanently treating every authenticated visitor as anonymous
    // in prod while working fine in dev (http, unprefixed). See
    // secure-cookie-prefix.server.ts's own comment for the exact same bug
    // class this file already had to account for once.
    const { getSecureCookiePrefix } = await import(
      '@/lib/secure-cookie-prefix.server'
    );
    const cookieName = `${getSecureCookiePrefix()}${SESSION_COOKIE_NAME}`;
    return Boolean(getCookies()[cookieName]);
  })
  .client(() => true);
