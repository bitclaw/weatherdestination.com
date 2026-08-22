// Content-Security-Policy directives, kept separate from securityMiddleware
// (src/start.ts) so adding a new third-party script/embed origin is a
// one-line diff here instead of a change buried in header-setting
// boilerplate. See docs/warpkit/security/security-headers.md.

type CspDirectives = {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'connect-src': string[];
  'font-src': string[];
  'worker-src': string[];
  'frame-src': string[];
  'object-src': string[];
  'base-uri': string[];
  'frame-ancestors'?: string[];
};

const baseDirectives: CspDirectives = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    'https://challenges.cloudflare.com', // Cloudflare Turnstile widget
    'https://static.cloudflareinsights.com', // Cloudflare's own edge-injected analytics beacon
    'https://www.clarity.ms', // Microsoft Clarity
    'https://scripts.clarity.ms', // Microsoft Clarity
    'https://client.crisp.chat', // Crisp chat widget
    'https://cloud.umami.is' // Umami analytics
  ],
  'style-src': ["'self'", "'unsafe-inline'", 'https://client.crisp.chat'],
  'img-src': ["'self'", 'data:', 'https:', 'https://*.crisp.chat'],
  'connect-src': [
    "'self'",
    'wss://*.crisp.chat',
    'https://*.crisp.chat',
    // Wildcarded rather than enumerated: Clarity reports to several
    // undocumented subdomains (e., n., i., ...) and adding them one at a
    // time as each shows up in a CSP violation is a losing game.
    'https://*.clarity.ms',
    'https://cloudflareinsights.com',
    'https://cloud.umami.is',
    'https://gateway.umami.is', // Umami cloud script posts events here, not cloud.umami.is
    'https://*.sentry.io'
  ],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'worker-src': ["'self'"],
  'frame-src': [
    "'self'",
    'https://challenges.cloudflare.com',
    'https://game.crisp.chat'
  ],
  'object-src': ["'none'"],
  'base-uri': ["'self'"]
};

// Vite dev server needs 'unsafe-eval' (HMR/eval-based module transforms)
// and worker-src blob: (Vite's dev-mode web worker loading); frame-ancestors
// is production-only to match X-Frame-Options: DENY set alongside it.
export function buildCsp(isProduction: boolean): string {
  const directives: CspDirectives = {
    ...baseDirectives,
    'script-src': isProduction
      ? baseDirectives['script-src']
      : [...baseDirectives['script-src'], "'unsafe-eval'"],
    'worker-src': isProduction
      ? baseDirectives['worker-src']
      : [...baseDirectives['worker-src'], 'blob:'],
    ...(isProduction ? { 'frame-ancestors': ["'none'"] } : {})
  };

  return (Object.entries(directives) as [string, string[]][])
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');
}

// Shared with server/start.ts's prerendered-HTML and static-asset fast
// paths, which construct Response objects directly and never pass through
// src/start.ts's securityMiddleware (that only runs for requests reaching
// ssr.fetch()). server/start.ts's own fast paths (prerendered HTML with no
// session cookie, static assets) always call this with isProduction=true -
// they only exist once a real build has run, so there's nothing to relax
// for local dev. But server/start.ts is a production entrypoint that still
// delegates to real SSR (a logged-in visitor hitting a prerendered path, or
// any route not covered by the fast paths), and those calls use
// `process.env.NODE_ENV === 'production'` like securityMiddleware does -
// this file is not the single source of the isProduction value, callers
// decide per response category.
export function applySecurityHeaders(
  headers: Headers,
  isProduction: boolean
): void {
  if (isProduction) {
    headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  headers.set('X-DNS-Prefetch-Control', 'off');
  if (isProduction) {
    headers.set('X-Frame-Options', 'DENY');
  }
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Content-Security-Policy', buildCsp(isProduction));
}
