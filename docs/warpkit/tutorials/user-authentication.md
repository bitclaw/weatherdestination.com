# User Authentication

Warpkit uses [better-auth](https://better-auth.com) for passwordless authentication. No passwords to store or hash.

## How it works

1. User enters email on `/login`
2. Warpkit sends a one-time code (OTP) or magic link via email
3. User verifies → session created → redirected to `/dashboard`

## Verification methods

Set `AUTH_VERIFICATION_METHOD` in `.env`:

| Value | Behavior |
|-------|----------|
| `otp` | 6-digit code sent via email (default) |
| `magic-link` | Clickable link sent via email |
| `both` | User can choose either |

## OAuth (Google / GitHub)

Set these env vars: Warpkit enables the provider automatically:

```bash
# Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# GitHub
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

No code changes required. If the env var is present, the OAuth button appears.

## Protecting a route

Wrap your route in the `_app` layout. Any route under `_app.*.tsx` requires an active session: the layout redirects unauthenticated users to `/login` automatically.

```
src/routes/
├── _app.tsx           ← auth guard lives here
├── _app.dashboard.tsx ← protected
├── _app.settings.tsx  ← protected
```

## Protecting a server function

Always use the shared `requireUser()` from `@/server/require-user` , don't reimplement it. Besides the session check, it also blocks accounts mid-deletion (`deletionPendingAt`) and caches the session lookup per request. A hand-rolled version that only checks `session?.user` would let a pending-deletion account authenticate.

```ts
import { requireUser } from '@/server/require-user';
import { ERROR_CODES } from '@/lib/constants';

export const myFn = createServerFn().handler(async () => {
  const user = await requireUser();
  if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
  // ...
});
```

## Turnstile (bot protection)

Enable Cloudflare Turnstile on the login form:

```bash
TURNSTILE_SECRET_KEY=...
VITE_TURNSTILE_SITE_KEY=...
```

Set `auth.turnstile.enabled = true` in `config.ts` or let it auto-detect from the env var. The captcha widget appears automatically on `/login`.
