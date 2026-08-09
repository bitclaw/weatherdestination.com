# Security Headers

Security headers are set inline via the `securityMiddleware` in `src/start.ts`. There is no separate middleware file.

## Headers set

| Header | Value | Notes |
|--------|-------|-------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Production only (HSTS) |
| `X-Content-Type-Options` | `nosniff` | |
| `X-Frame-Options` | `DENY` | Production only |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | |
| `Permissions-Policy` | Disables camera, microphone, geolocation, payment | |
| `Cross-Origin-Opener-Policy` | `same-origin` | |
| `Content-Security-Policy` | Configured per app | Includes Cloudflare Turnstile, Crisp, Umami, Sentry |

## Headers intentionally NOT set

`X-XSS-Protection` is not set. This header is deprecated by modern browsers (Chrome removed it, Firefox never supported it). Browsers that still support it default to `1; mode=block` anyway. CSP provides superior XSS protection.

## Customizing

Edit `src/start.ts` — the `securityMiddleware` handler. Adjust or remove headers as needed, except CSP (see below).

## Content-Security-Policy

CSP directives live in `src/server/csp.ts`, not inline in `start.ts` — a first-class file
specifically so adding a third-party origin is a one-line diff to a directive array
instead of a change buried in header-setting boilerplate. `buildCsp(isProduction)` returns
the joined header string; `securityMiddleware` in `start.ts` just calls it.

The base directives allow-list the specific third-party origins this template ships with
integrations for: Cloudflare Turnstile (`challenges.cloudflare.com`) and Cloudflare's own
edge-injected analytics beacon (`static.cloudflareinsights.com`, `cloudflareinsights.com`),
Microsoft Clarity (`www.clarity.ms`, `scripts.clarity.ms`, plus its `e.clarity.ms`/`n.clarity.ms`
report endpoints in `connect-src`), Crisp chat (`*.crisp.chat`, `client.crisp.chat`,
`game.crisp.chat`), Umami analytics (`cloud.umami.is`), and Sentry (`*.sentry.io`).
`'unsafe-eval'` and `worker-src blob:` are added only outside production (Vite dev server
needs them). `frame-ancestors 'none'` is added only in production, matching
`X-Frame-Options: DENY`.

Adding a new third-party script/embed requires adding its origin to the relevant
directive array in `src/server/csp.ts` — a CSP violation shows up as a silent
browser-console block, not a visible error. `src/server/csp.test.ts` covers the
prod/non-prod branching; it does not (and can't) catch a missing origin, since that's
a product decision, not a logic bug.

## Request IDs

Every request gets a unique `X-Request-Id` header via `requestIdMiddleware` in `src/start.ts`. The ID is available in route handlers via `event.context.requestId` and included in structured logs.

## CORS

No CORS headers are set anywhere in the codebase, and none are configured. The SSR app serves the API from the same origin as the frontend, so cross-origin requests never need to succeed , if you add a public API consumed from another origin, add explicit CORS headers for that route rather than a blanket policy.
