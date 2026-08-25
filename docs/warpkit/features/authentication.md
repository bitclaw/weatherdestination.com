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

## Two-factor authentication (TOTP)

better-auth's `twoFactor` plugin (`src/server/auth.ts`) adds optional TOTP-based 2FA with backup codes. Users enable it themselves from Settings → Account (`TwoFactorSection`, `src/features/account/components/`). `allowPasswordless: true` is mandatory in the plugin config — this app has zero password auth anywhere, and the plugin hard-requires a password for enable/disable otherwise.

**Why this needed custom work, not just the plugin default:** better-auth's built-in 2FA sign-in gate only matches `/sign-in/email`, `/sign-in/username`, and `/sign-in/phone-number` — credential (password) sign-in paths. This app is 100% passwordless (`emailOTP`/`magicLink`/social OAuth), so the built-in gate never fires for any sign-in path this app actually uses. Installing the plugin and stopping there means a 2FA-enabled user gets a fully valid session on every real sign-in with **no code prompt at all** — a real auth bypass, not a UX gap. Confirmed directly against the installed `better-auth` package's own matcher, not assumed from docs.

**The fix**: `src/server/auth.ts`'s `hooks.after` replicates the built-in gate's own mechanism (delete the just-created session, write a pending-2FA verification record + signed `two_factor` cookie in the exact shape the plugin's own `/two-factor/verify-totp`/`/two-factor/verify-backup-code` endpoints already know how to read) for the three sign-in paths this app actually uses:

- **Branch A** — `/sign-in/email-otp` (JSON response path, the client's `authClient.signIn.emailOtp()` call reads `twoFactorRedirect` off the response body directly)
- **Branch B** — `/magic-link/verify` (redirect path — a plain GET hit from the emailed link, no client JS in the loop, so the challenge has to override the handler's own redirect rather than return JSON)
- **Branch C** — `/callback/*` (all OAuth providers — same bypass class as A/B, since the built-in gate doesn't cover OAuth callbacks either; one branch covers every provider via the shared path prefix)

All three funnel through one shared function, `bridgeTwoFactorChallenge` (exported from `auth.ts` for direct unit testing — see `src/server/two-factor-hooks.test.ts`). It takes an injectable `deleteSessionCookieFn` parameter (defaulting to the real `deleteSessionCookie` from `better-auth/cookies`) so the bridge's own write sequence — session deletion, the two verification records (the pending challenge itself, and a companion attempts-counter record the plugin's own `beginAttempt()` requires or every verify call fails with `INVALID_TWO_FACTOR_COOKIE` regardless of the code entered), and the signed cookie — is testable without needing a fake `ctx` that also satisfies `deleteSessionCookie`'s much larger internal surface.

New user lands on `/two-factor` (`src/pages/two-factor/`, `src/routes/_auth.two-factor.tsx`) to enter a code or backup code. `redirectTo` is carried through for Branch A/B (`sanitizeRedirectPath`-validated on the client route, same as `/login`'s own redirect param); Branch C deliberately does not carry a destination through — the OAuth callback's original target lives in a signed `state` param this app has no public API to re-parse, so post-2FA OAuth sign-ins land on the default destination instead of a provider-specific one. Documented simplification, not an oversight.

**Schema**: `users.twoFactorEnabled` + a new `twoFactor` table (secret/backup codes plugin-encrypted at rest — not app-hashed like `api-keys`). Also required a `better-auth` 1.6→1.7 bump, which independently needed `accounts.issuer` (better-auth 1.7 resolves account identity by `(issuer, accountId)` instead of `(providerId, accountId)`) — nullable column, deliberately (SQLite rejects a `NOT NULL` column with no default on a non-empty table), backfilled per-provider on any deployment upgrading from a pre-1.7 install (no backfill script ships here — a fresh clone has no pre-1.7 rows to migrate).

**`genericOAuthClient()` was removed** from `auth-client.ts` as part of this bump — confirmed absent from better-auth 1.7.1's `client/plugins` exports (the generic-OAuth plugin was rebuilt as a first-class social provider in 1.7.0). No `signIn.oauth2`/`oauth2.link` usage exists anywhere in this app, so nothing depended on it. The server-side `genericOAuth` plugin (Bitbucket) is unaffected — only the client-side wrapper moved.

**Known limitation**: Branch C (OAuth) is source-verified but not exercised end-to-end against a real provider in this app's own test/dev setup (no OAuth credentials configured there). Branches A and B are both fully verified end-to-end — real TOTP codes, real sessions, real UI — against a running server.

## Welcome email

A welcome email is sent automatically on first signup via `databaseHooks.user.create.after` in `src/server/auth.ts`. Edit the `WelcomeEmail` template in `src/server/email-templates.tsx`.

## Session cookie prefix

The cookie is named `{appName}.session_token` (derived from `config.appName`). Import `SESSION_COOKIE_NAME` from `@/config` instead of hardcoding. Change the prefix in `src/server/auth.ts` under `advanced.cookiePrefix`, and update `SESSION_COOKIE_NAME` in `config.ts` to match.

## Turnstile bot protection

Set `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` to enable Cloudflare Turnstile on the login form. The captcha plugin is registered in better-auth when the env var is present.

**Privacy policy requirement:** if you enable Turnstile, Cloudflare requires you to reference their [Turnstile Privacy Policy](https://www.cloudflare.com/en-gb/turnstile-privacy-policy/) in your own privacy policy — this applies regardless of widget mode (managed/non-interactive/invisible), and is a stricter requirement for invisible mode specifically. This is not done for you automatically since the template ships with Turnstile disabled by default; add it to your privacy policy page once you turn Turnstile on.

**Styling the widget:** `TurnstileProvider` (`src/features/captcha/TurnstileProvider.tsx`) accepts `theme` (`'light' | 'dark' | 'auto'`, default `'auto'`) and `size` (`'normal' | 'compact' | 'flexible'`, default `'normal'`) props, passed straight through to `turnstile.render()`'s options. `AuthLayout.tsx` sets `size="flexible"` so the widget stretches to match the email input's width instead of Cloudflare's fixed 300×65px default. The widget renders inside a cross-origin iframe — its internal contents (colors, fonts, logo) cannot be styled with CSS or JS, only these config options and the outer container's layout. See Cloudflare's [widget configurations reference](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/) for the full attribute list (themes, sizes, appearance modes, callbacks).
