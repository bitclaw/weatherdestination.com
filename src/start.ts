import { sentryGlobalRequestMiddleware } from '@sentry/tanstackstart-react';
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart
} from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { randomUUIDv7 } from 'bun';
import { buildCsp } from '@/server/csp';

// Dynamic import + lazy memoization, not a top-level import - this file is a
// shared client+server entry point (see the comment below on
// event-handlers), so a top-level `createLogger` import/call pulls pino's
// browser shim into the client bundle even though loggerMiddleware only
// ever runs server-side (confirmed via a real build - same leak class fixed
// in auth-hooks.ts/events.ts). Memoized behind a module-scope promise so
// every request after the first reuses the same logger instance instead of
// re-importing per request.
let logPromise:
  | Promise<ReturnType<typeof import('@/lib/logger')['createLogger']>>
  | undefined;
const getLog = async () => {
  logPromise ??= import('@/lib/logger').then(({ createLogger }) =>
    createLogger({ middleware: 'request-logger' })
  );
  return logPromise;
};

const SETTINGS_KEY_LENGTH = 64; // 32 bytes = 64 hex chars for AES-256-GCM

// Set by @tanstack/start-plugin-core immediately before vite build's
// prerender step boots a real in-process server to crawl `/` - that instance
// constructs real better-auth/Stripe/Resend clients but has no real secrets
// available at build time. Every production-only check below skips while
// this is set, so the build doesn't need to fake secrets by lying about
// NODE_ENV (see git history: this file, the Dockerfile, and Makefile all
// used to set NODE_ENV=test for the build specifically to dodge these
// checks, which silently froze every NODE_ENV==='production' branch in the
// entire shipped bundle - rate limiters, HSTS, CSP, secure cookie prefix,
// the works - since Vite/Rollup resolves and dead-code-eliminates
// process.env.NODE_ENV at build time, not read live at runtime).
const isPrerenderCrawl = process.env.TSS_PRERENDERING === 'true';

if (import.meta.env.SSR) {
  const encKey = process.env.SETTINGS_ENCRYPTION_KEY;
  if (
    encKey &&
    (encKey.length !== SETTINGS_KEY_LENGTH || !/^[0-9a-f]+$/i.test(encKey))
  ) {
    throw new Error(
      `SETTINGS_ENCRYPTION_KEY must be a ${SETTINGS_KEY_LENGTH}-char hex string (${SETTINGS_KEY_LENGTH / 2} bytes). ` +
        `Generate: openssl rand -hex ${SETTINGS_KEY_LENGTH / 2}`
    );
  }

  // The client widget renders based on VITE_TURNSTILE_SITE_KEY, but
  // verifyTurnstileToken (and better-auth's captcha plugin) fail OPEN
  // (treat as verified) when TURNSTILE_SECRET_KEY is unset - matching the
  // "activates via env var" convention for the fully-disabled case. If only
  // the site key is set, the widget renders and looks like real protection
  // while every submission silently skips verification. Fail loud at boot
  // instead of shipping broken bot protection silently.
  if (
    process.env.VITE_TURNSTILE_SITE_KEY &&
    !process.env.TURNSTILE_SECRET_KEY
  ) {
    throw new Error(
      'VITE_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is not , ' +
        'the Turnstile widget would render without any server-side verification. ' +
        'Set TURNSTILE_SECRET_KEY too, or unset VITE_TURNSTILE_SITE_KEY to disable captcha entirely.'
    );
  }
  // Startup reconciliation (account deletion, billing), job workers, and
  // Sentry init all live in server/start.ts, not here , Vite's
  // import-protection plugin does static analysis on dynamic import()
  // tokens regardless of this SSR guard, since this file is a shared entry
  // point its client bundler also inspects. server/start.ts is a plain Bun
  // script never touched by that bundler, so it's the one place these are
  // safe. (They previously lived in a server/plugins/ Nitro plugin, which
  // documented the same rationale , but that mechanism never actually ran;
  // see docs/warpkit/features/jobs.md.)
  import('@/server/event-handlers').catch(async error => {
    (await getLog()).error({ error }, 'event-handlers module failed to load');
  });

  // src/lib/http-clients/stripe.ts falls back to 'sk_test_placeholder' when
  // unset, so a missing key would otherwise fail silently at the first real
  // Stripe API call instead of at boot. Only checked in production , dev/test
  // both rely on the placeholder fallback (tests intercept Stripe calls via
  // MSW, never hitting the real API with the fake key).
  if (
    process.env.NODE_ENV === 'production' &&
    !isPrerenderCrawl &&
    !process.env.STRIPE_SECRET_KEY
  ) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set , billing will silently fail on every Stripe API call. Set it in your production environment.'
    );
  }

  // sendEmail() (src/server/email.ts) returns a normal err() Result when
  // RESEND_API_KEY is unset - never throws, so every welcome/receipt/
  // reengagement email would silently no-op with nothing visible except a
  // per-call log line. Fail loud at boot instead. Only the default 'resend'
  // provider needs this key; 'smtp' has its own SMTP_HOST/PORT config.
  if (
    process.env.NODE_ENV === 'production' &&
    !isPrerenderCrawl &&
    (process.env.EMAIL_PROVIDER ?? 'resend') === 'resend' &&
    !process.env.RESEND_API_KEY
  ) {
    throw new Error(
      'RESEND_API_KEY is not set , every outgoing email will silently fail. Set it, or set EMAIL_PROVIDER=smtp with the matching SMTP_* vars.'
    );
  }

  // requireAdmin() (src/server/require-admin.ts) checks session.user.email
  // against ADMIN_EMAILS - if unset, that check always fails and nobody can
  // ever become an admin, with no error, just permanent 403s.
  if (
    process.env.NODE_ENV === 'production' &&
    !isPrerenderCrawl &&
    !(process.env.ADMIN_EMAILS ?? '').trim()
  ) {
    throw new Error(
      'ADMIN_EMAILS is not set , no account will ever be able to reach the admin dashboard. Set it to a comma-separated list of admin emails.'
    );
  }

  // config.uploads.enabled is derived from the client-exposed
  // VITE_S3_FILES_BUCKET only (see config.ts) , it can't also check the
  // server-only AWS_S3_* vars without leaking them into the client bundle.
  // If VITE_S3_FILES_BUCKET is set but the server-only vars aren't, the
  // Files page renders as enabled while every upload silently fails.
  if (
    process.env.NODE_ENV === 'production' &&
    !isPrerenderCrawl &&
    process.env.VITE_S3_FILES_BUCKET &&
    (!process.env.AWS_S3_FILES_BUCKET ||
      !process.env.AWS_S3_IAM_ACCESS_KEY ||
      !process.env.AWS_S3_IAM_SECRET_KEY)
  ) {
    throw new Error(
      'VITE_S3_FILES_BUCKET is set but AWS_S3_FILES_BUCKET/AWS_S3_IAM_ACCESS_KEY/AWS_S3_IAM_SECRET_KEY are not , ' +
        'the Files page will render as enabled while every upload fails server-side. Set all four, or unset VITE_S3_FILES_BUCKET to disable uploads entirely.'
    );
  }
}

const loggerMiddleware = createMiddleware().server(
  async ({ next, context, request }) => {
    const path = new URL(request.url).pathname;
    if (
      !path.startsWith('/@') &&
      !path.startsWith('/node_modules/') &&
      !path.startsWith('/src/')
    ) {
      (await getLog()).info({
        method: request.method,
        path,
        // weak-type-ok: middleware context has no exported requestId type from the framework
        requestId: (context as unknown as { requestId?: string }).requestId
      });
    }
    return next();
  }
);

const requestIdMiddleware = createMiddleware().server(async ({ next }) => {
  const requestId = randomUUIDv7();
  setResponseHeader('x-request-id', requestId);
  return next({ context: { requestId } });
});

const securityMiddleware = createMiddleware().server(async ({ next }) => {
  if (process.env.NODE_ENV === 'production') {
    setResponseHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  setResponseHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  setResponseHeader('X-DNS-Prefetch-Control', 'off');
  if (process.env.NODE_ENV === 'production') {
    setResponseHeader('X-Frame-Options', 'DENY');
  }
  setResponseHeader('X-Content-Type-Options', 'nosniff');
  setResponseHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  setResponseHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // CSP tradeoff: img https: needed for arbitrary OAuth avatar CDNs,
  // unsafe-inline for third-party embed/theme-init scripts. Nonce-based CSP
  // deferred, not an oversight.
  setResponseHeader(
    'Content-Security-Policy',
    buildCsp(process.env.NODE_ENV === 'production')
  );
  return next();
});

const csrfMiddleware = createCsrfMiddleware({
  filter: ctx => ctx.handlerType === 'serverFn'
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    sentryGlobalRequestMiddleware,
    requestIdMiddleware,
    loggerMiddleware,
    securityMiddleware
  ]
}));
