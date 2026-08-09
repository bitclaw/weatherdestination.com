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

**Error boundary components** (already wired in `src/pages/error-pages/error.tsx`):

```ts
import { captureException } from '@sentry/tanstackstart-react';
import { useEffect } from 'react';

export function ErrorPage({ error }: { error: unknown }) {
  useEffect(() => {
    captureException(error);
  }, [error]);
  // ...
}
```

**Server-side errors** (same SDK, works in both runtimes):

```ts
import { captureException } from '@sentry/tanstackstart-react';

captureException(err);
```

## CSP

`src/start.ts` includes `https://*.sentry.io` in the `connect-src` directive. If you customize the CSP, preserve this entry or browser error reports will be blocked.

## Configuration

Sampling rates and other options are in `src/lib/sentry.ts` (browser) and inline in `server/start.ts` (server):

```ts
tracesSampleRate: 0.2,   // 20% of transactions
sendDefaultPii: false    // no PII in events
```

Adjust `tracesSampleRate` based on your traffic volume and Sentry plan quota.
