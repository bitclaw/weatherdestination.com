import { config } from '@/config';

// Mirrors src/server/auth.ts's isDev/baseURL branching exactly. better-auth
// derives its `__Secure-` cookie prefix from whether baseURL resolves to an
// https:// URL: dev's baseURL is an object with protocol: 'http' (always
// unprefixed); prod's baseURL is a string that defaults to a placeholder
// https:// domain when BETTER_AUTH_URL is unset (prefixed, unless that env
// var is explicitly set to an http:// URL). Any code that hand-signs a
// session_token/session_data cookie outside better-auth's own sign-in flow
// (loadtest scripts) must replicate this exact logic, or the cookie name
// silently won't match what auth.api.getSession() reads - see
// docs/warpkit/performance.md, "cross-worker session visibility" correction.
export function getSecureCookiePrefix(): string {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) return '';
  const baseURL = process.env.BETTER_AUTH_URL ?? `https://${config.domainName}`;
  return baseURL.startsWith('https://') ? '__Secure-' : '';
}
