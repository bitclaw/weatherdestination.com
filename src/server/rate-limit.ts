/**
 * In-memory rate limiter for server functions and H3 event handlers.
 * IP extraction controlled by TRUST_PROXY env var (default: none). Disabled
 * outside production (dev/test run unthrottled) and during vite build's own
 * prerender crawl (TSS_PRERENDERING) - the crawl boots a real in-process
 * server under NODE_ENV=production with no real client behind it, so
 * without this a rate-limited loader on a prerendered page could 429 during
 * the build. See src/start.ts for why TSS_PRERENDERING, not NODE_ENV, is the
 * right signal for "this is the prerender crawl, not a real deploy."
 */

import { getRequestHeaders } from '@tanstack/react-start/server';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type Config = {
  windowMs: number;
  max: number;
  // When true, a request with no resolvable client IP (no explicit key,
  // getClientIP() returns null) is blocked outright instead of falling into
  // the shared 'unknown' bucket. Without this, TRUST_PROXY misconfiguration
  // (or its 'none' default) collapses every caller into one global budget -
  // fine for a low-stakes limiter, not for anything auth-adjacent (OTP/
  // magic-link-adjacent endpoints, pre-auth admin gates), where one attacker
  // exhausting the shared bucket locks out every real user.
  failClosedOnUnknownIp?: boolean;
};

const CLEANUP_INTERVAL = 5 * 60 * 1000;

export function createRateLimiter(config: Config) {
  const store = new Map<string, RateLimitEntry>();
  let lastCleanup = Date.now();

  const cleanup = () => {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  };

  /** Returns true if the request should be blocked. */
  const check = (key?: string): boolean => {
    if (process.env.NODE_ENV !== 'production') return false;
    if (process.env.TSS_PRERENDERING === 'true') return false;

    cleanup();

    const clientIp = key ? undefined : getClientIP();
    if (!key && !clientIp && config.failClosedOnUnknownIp) return true;

    const resolvedKey = key ?? clientIp ?? 'unknown';
    const now = Date.now();
    let entry = store.get(resolvedKey);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + config.windowMs };
      store.set(resolvedKey, entry);
    }

    entry.count++;
    return entry.count > config.max;
  };

  return { check };
}

/**
 * Reads a single header from either a real Headers instance (what
 * @tanstack/react-start/server's getRequestHeaders() actually returns -
 * getH3Event().req.headers) or a plain object (what callers passing an
 * explicit headers arg use). Bracket access on a real Headers instance is
 * silently undefined for every key - it's a class with a .get() method,
 * not a plain object - so treating the two shapes the same way was a real
 * bug: getClientIP() never actually extracted an IP for any caller relying
 * on the default getRequestHeaders() path, regardless of TRUST_PROXY or
 * what headers were actually present. Confirmed by checking
 * node_modules/@tanstack/start-server-core/dist/esm/request-response.js.
 */
function readHeader(
  headers: Record<string, string | undefined> | Headers,
  name: string
): string | undefined {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? undefined;
  }
  return (headers as Record<string, string | undefined>)[name];
}

/** Extract client IP based on TRUST_PROXY setting.
 *  cloudflare: cf-connecting-ip
 *  nginx:      x-real-ip (set by nginx proxy_set_header X-Real-IP $remote_addr)
 *  proxy:      x-forwarded-for[0] (Caddy, haproxy, any sanitizing reverse proxy)
 *  none:       always null (direct internet, no proxy)
 *
 *  None of these headers are spoof-proof unless the origin actually refuses
 *  direct traffic that bypasses the proxy (e.g. firewalling to Cloudflare's
 *  published IP ranges). See .env.example's TRUST_PROXY section.
 */
export function getClientIP(
  headers?: Record<string, string | undefined> | Headers
): string | null {
  try {
    const trustProxy = process.env.TRUST_PROXY ?? 'none';
    const h = headers ?? getRequestHeaders();
    if (trustProxy === 'cloudflare') {
      return readHeader(h, 'cf-connecting-ip') ?? null;
    }
    if (trustProxy === 'nginx') {
      return readHeader(h, 'x-real-ip') ?? null;
    }
    if (trustProxy === 'proxy') {
      return readHeader(h, 'x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
