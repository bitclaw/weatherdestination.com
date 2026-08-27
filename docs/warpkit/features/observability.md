# Observability (Sentry)

Error tracking via Sentry. Optional: omit `VITE_SENTRY_DSN` to disable entirely.

## Setup

```bash
# .env
VITE_SENTRY_DSN=https://...@...ingest.sentry.io/...
```

DSNs are public by design and safe to commit or expose client-side. The `VITE_` prefix makes the value available to the browser bundle.

## How it works

| Where | When | SDK |
|------|------|-----|
| `src/lib/sentry.ts` | `__root.tsx` module evaluation (browser only) | `@sentry/tanstackstart-react` |
| Inline in `server/start.ts` | Server boot, guarded on `VITE_SENTRY_DSN` (only under `bun run start`, not `bun run dev` , see CLAUDE.md's "Server Boot Side Effects") | `@sentry/tanstackstart-react` |

`src/lib/sentry.ts` doesn't need to be imported from application code , it self-initializes on module evaluation. The server-side `init()` call is not, and cannot be, a separate self-loading file: it previously lived in `server/plugins/sentry.ts` as a Nitro plugin, but that mechanism never actually ran (Nitro's plugin auto-load requires registering Nitro's own Vite plugin, which this project never did , see `docs/warpkit/features/jobs.md`'s "Why server/start.ts, not a Nitro plugin"). Do not call `init()` anywhere else.

## Capturing errors

**Error boundary components** (already wired in `src/pages/error-pages/error.tsx`, rendered both as `__root.tsx`'s route-level `errorComponent` and as the `fallback` for the `<ErrorBoundary>` wrapping `<Outlet/>` in the same file):

```ts
import { captureException } from '@sentry/tanstackstart-react';
import { useEffect, useState } from 'react';

type Props = { error: unknown; reset?: () => void; eventId?: string | null };

export function ErrorPage({ error, reset, eventId: providedEventId }: Props) {
  const [eventId, setEventId] = useState<string | null>(providedEventId ?? null);

  useEffect(() => {
    // Sentry's own <ErrorBoundary fallback> already captured this and
    // computed an event id - only self-capture when nothing did (e.g. when
    // this component is used as TanStack Router's own errorComponent
    // instead, which doesn't pass eventId).
    if (providedEventId !== undefined) return;
    setEventId(captureException(error));
  }, [error, providedEventId]);
  // ...
}
```

**`<ErrorBoundary>` MUST get a `fallback` prop.** `__root.tsx` wraps `<Outlet/>` in `@sentry/react`'s `<ErrorBoundary>` to catch render-time exceptions that TanStack Router's own `errorComponent` never sees (Router's `errorComponent` only fires for loader/`beforeLoad` errors, not exceptions thrown while a route's own `component` renders). Passing no `fallback` at all is a real bug that shipped to this app's production: `@sentry/react`'s `ErrorBoundary.render()` returns `null` when it catches an error and `fallback` wasn't provided (confirmed by reading `node_modules/@sentry/react/build/cjs/errorboundary.js` directly) - the entire app goes silently blank, no error message, no recovery button, just the bare `<body>` background color. This shipped undetected because Sentry still captured the exception either way and nothing about the blank screen itself ever reached Sentry. Always wire it:

```tsx
<ErrorBoundary
  fallback={({ error, eventId, resetError }) => (
    <ErrorPage error={error} eventId={eventId} reset={resetError} />
  )}
>
  <Outlet />
</ErrorBoundary>
```

**Server-side errors** (same SDK, works in both runtimes):

```ts
import { captureException } from '@sentry/tanstackstart-react';

captureException(err);
```

## Source maps (do this - errors are unreadable without it)

By default, `sentryTanstackStart()` in `vite.config.ts` still runs, but **without a Sentry auth token it cannot upload source maps** - every production error you'll ever see in Sentry shows up as minified garbage: a bare `Error: undefined` (or similarly useless message) with no file, no line, no real stack trace, no matter how good your own error-handling code is. This is the default state of every fresh clone of this template, and it turned a real production bug into hours of guesswork before anyone noticed sourcemaps were never wired up in the first place. Set this up as soon as Sentry is configured at all, not after the first confusing error report.

**1. Generate an auth token** - Sentry dashboard → **Settings → Auth Tokens** (organization-level, not project-level) → **Create New Token**, scoped to `project:releases` (the minimum scope source map upload needs).

**2. Add three env vars to your production environment** (wherever you manage deploy-time secrets - these must be present during the **build** step, not just at server runtime, since sourcemap upload happens as part of `vite build`):

```bash
SENTRY_AUTH_TOKEN=sntrys_...       # the token from step 1 - keep secret, do NOT prefix with VITE_
SENTRY_ORG=your-org-slug           # from the Sentry dashboard URL
SENTRY_PROJECT=your-project-slug   # from the Sentry project settings
```

`sentryTanstackStart()` (`vite.config.ts`) auto-detects all three from the environment - no code change needed once they're set. It also auto-enables `'hidden'` source maps if you haven't explicitly configured sourcemap generation elsewhere, and deletes the local `.map` files after a successful upload so they never ship to the browser (Sentry has them; the public bundle doesn't).

**3. Redeploy.** Only errors captured *after* a build with these env vars present will have real stack traces - this cannot be retroactively applied to already-captured events.

**Verify it worked**: trigger any error in production, open the event in Sentry, and check for a real file/line in the stack trace (not a minified one-liner) and readable original source in the code context panel. If you still see minified output, double check the three env vars actually reached the **build** environment - a common mistake is adding them only to the server's runtime env (e.g. `.env.production` read at boot) without confirming the deploy pipeline also exports them during the `vite build`/`bun run build` step itself.

## CSP

`src/start.ts` includes `https://*.sentry.io` in the `connect-src` directive. If you customize the CSP, preserve this entry or browser error reports will be blocked.

## Configuration

Sampling rates and other options are in `src/lib/sentry.ts` (browser) and inline in `server/start.ts` (server):

```ts
tracesSampleRate: 0.2,   // 20% of transactions
sendDefaultPii: false    // no PII in events
```

Adjust `tracesSampleRate` based on your traffic volume and Sentry plan quota.
