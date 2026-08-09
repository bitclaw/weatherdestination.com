# Authentication

Warpkit uses [better-auth](https://better-auth.com) for passwordless authentication. Configured in `src/server/auth.ts`.

## Methods

| Method | Env var | Description |
|--------|---------|-------------|
| OTP | `AUTH_VERIFICATION_METHOD=otp` | 6-digit code via email |
| Magic link | `AUTH_VERIFICATION_METHOD=magic-link` | Clickable link via email |
| Both | `AUTH_VERIFICATION_METHOD=both` | User picks one |
| Google OAuth | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Auto-enabled when env vars set |
| GitHub OAuth | `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` | Auto-enabled when env vars set |
| GitLab OAuth | `GITLAB_CLIENT_ID` + `GITLAB_CLIENT_SECRET` | Auto-enabled when env vars set |
| Bitbucket OAuth | `BITBUCKET_CLIENT_ID` + `BITBUCKET_CLIENT_SECRET` | Auto-enabled when env vars set |

Social providers activate automatically when the corresponding env vars are present — no code change needed.

## Multi-session support

Users can be logged in on multiple devices simultaneously. better-auth's `multiSession` plugin is enabled by default (max 5 sessions).

## Requiring auth in a server function

```ts
import { getRequestHeaders } from '@tanstack/react-start/server';
import { ERROR_CODES } from '@/lib/constants';
import { auth } from '@/server/auth';

const requireUser = async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  return session.user;
};

export const myFn = createServerFn().handler(async () => {
  const user = await requireUser();
  if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
  // user.id, user.email, user.name available
});
```

The `requireUser` helper is available from `@/server/require-user`. `requireAdmin` is available from `@/server/require-admin`.

## Disposable-email and MX-record checks

Two independent gates exist, with different purposes:

**1. Auth-server gate (unconditional security backstop)**

`src/server/auth.ts` calls `isDisposableEmail()` inside the OTP and magic-link send handlers. If the address is disposable, the send throws before any email is sent. This gate is **hardcoded and always active** — there is no env var to disable it. It prevents disposable addresses from ever receiving a sign-in link or OTP code.

**2. Optional pre-submit UX validator (`validateEmail` server fn)**

`src/features/email-validation` exports a `validateEmail` server fn that checks both disposable providers and optional MX-record validity before the user submits the form. Controlled by two toggles in `config.ts`:

```ts
// config.ts
disposableEmailCheck: process.env.VITE_DISPOSABLE_EMAIL_CHECK !== 'false',
mxCheck: process.env.VITE_MX_CHECK === 'true',
```

- `disposableEmailCheck`: rejects addresses from temporary email providers (e.g. Mailinator, Guerrilla Mail). Default: **on**.
- `mxCheck`: rejects domains with no valid MX record (no mail server configured). Default: **off**.

MX lookups have a 5s DNS timeout (`email-validation-logic.ts`) so a slow/unresponsive DNS server fails open rather than hanging the request. Failures return `ERROR_CODES.EMAIL_DISPOSABLE` or `ERROR_CODES.EMAIL_DOMAIN_INVALID`.

The validator is wired into login and signup as a pre-submit check. It produces a friendlier inline error and saves a wasted OTP/magic-link send. The auth-server gate in `auth.ts` stays in place as the security backstop regardless of whether the validator is enabled.

## Welcome email

A welcome email is sent automatically on first signup via `databaseHooks.user.create.after` in `src/server/auth.ts`. Edit the `WelcomeEmail` template in `src/server/email-templates.tsx`.

## Session cookie prefix

The cookie is named `{appName}.session_token` (derived from `config.appName`). Import `SESSION_COOKIE_NAME` from `@/config` instead of hardcoding. Change the prefix in `src/server/auth.ts` under `advanced.cookiePrefix`, and update `SESSION_COOKIE_NAME` in `config.ts` to match.

## Turnstile bot protection

Set `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` to enable Cloudflare Turnstile on the login form. The captcha plugin is registered in better-auth when the env var is present.

**Privacy policy requirement:** if you enable Turnstile, Cloudflare requires you to reference their [Turnstile Privacy Policy](https://www.cloudflare.com/en-gb/turnstile-privacy-policy/) in your own privacy policy — this applies regardless of widget mode (managed/non-interactive/invisible), and is a stricter requirement for invisible mode specifically. This is not done for you automatically since the template ships with Turnstile disabled by default; add it to your privacy policy page once you turn Turnstile on.

**Styling the widget:** `TurnstileProvider` (`src/features/captcha/TurnstileProvider.tsx`) accepts `theme` (`'light' | 'dark' | 'auto'`, default `'auto'`) and `size` (`'normal' | 'compact' | 'flexible'`, default `'normal'`) props, passed straight through to `turnstile.render()`'s options. `AuthLayout.tsx` sets `size="flexible"` so the widget stretches to match the email input's width instead of Cloudflare's fixed 300×65px default. The widget renders inside a cross-origin iframe — its internal contents (colors, fonts, logo) cannot be styled with CSS or JS, only these config options and the outer container's layout. See Cloudflare's [widget configurations reference](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/) for the full attribute list (themes, sizes, appearance modes, callbacks).
