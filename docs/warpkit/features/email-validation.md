# Email Validation (disposable + MX)

Warpkit blocks disposable email addresses at signup/login twice: a pre-submit
validator in the login/signup forms (UX layer) and an inline check in the auth
server hooks (security layer). These are two separate mechanisms; know which
one you are touching.

## The canonical gate: inline in `src/server/auth.ts`

The OTP and magic-link send handlers both call `isDisposableEmail(email)` from
`@bitclaw/disposable-email` and throw before any email is sent:

```ts
async sendVerificationOTP({ email, otp }) {
  if (isDisposableEmail(email))
    throw new Error('Disposable email addresses are not allowed');
  // ... send OTP email
}
```

This is the **source of truth** for disposable-email gating. It runs on every
passwordless signup/login path and cannot be bypassed by skipping client-side
validation. Social OAuth signups are not gated here: the email comes from the
OAuth provider (Google/GitHub), which has already verified it.

Why a throw instead of `err(...)`? These handlers run inside better-auth's
plugin lifecycle, not inside a warpkit server function. better-auth converts
the throw into a failed auth API response; the Result convention does not apply
in this layer.

## The pre-submit validator: `src/features/email-validation/`

`validateEmail` (server fn, POST) performs a stricter two-step check:

1. Disposable-domain check (same list as the auth gate), controlled by
   `config.auth.disposableEmailCheck`
2. MX-record DNS lookup (5s timeout), controlled by `config.auth.mxCheck`,
   which catches typo domains that cannot receive mail at all

It is wired into `handleEmailSubmit` in both `src/pages/login/index.tsx` and
`src/pages/signup/index.tsx`: the form calls it before requesting an OTP or
magic link, shows the error inline, and skips the send entirely on failure.
The call is guarded by the config flags, so disabling both checks removes the
extra roundtrip. This layer is UX only; the auth.ts gate above is what makes
the block unbypassable.

Error codes: `ERROR_CODES.EMAIL_DISPOSABLE`, `ERROR_CODES.EMAIL_DOMAIN_INVALID`.

## Why the logic is split into `email-validation-logic.ts`

`@bitclaw/disposable-email` uses `node:dns`, so the server fn dynamic-imports it
inside the handler (client-bundle safety) and injects the functions into the
pure `validateEmailLogic`, which has zero Node imports and is unit-tested with
hand-rolled fakes (sanctioned injectable-interface pattern, see the testing
skill).

## Changing behavior

- Loosen/tighten the pre-submit validator: `config.auth.disposableEmailCheck`,
  `config.auth.mxCheck` in `config.ts`
- The auth.ts gate is unconditional by design. If you must allow disposable
  addresses (e.g. internal testing), edit both send handlers in
  `src/server/auth.ts`; there is no config flag, deliberately, so relaxing the
  security gate is an explicit code change that shows up in review.
