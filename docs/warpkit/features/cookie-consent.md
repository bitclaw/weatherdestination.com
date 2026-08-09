# Cookie Consent

GDPR-style consent banner via `vanilla-cookieconsent`, rendered globally and toggled
at runtime through a feature flag , no redeploy needed to turn it on or off.

## How it works

- `CookieConsentBanner` lives at `src/components/cookie-consent/CookieConsentBanner.tsx`
  and is mounted once in `src/routes/__root.tsx`, so it covers every route.
- The component reads the `cookie_consent_enabled` feature flag via `useFeatureFlag`.
  When the flag is off, the banner itself doesn't render, but the Umami and Clarity
  scripts (if configured) still load unconditionally on mount , an explicit admin
  opt-out of consent gating, not a no-op. Toggling happens live at
  `/dashboard/admin/feature-flags`.
- When enabled, `CookieConsent.run()` shows a bottom-right consent modal with two
  categories:
  - `necessary` , enabled and read-only (session cookies, CSRF, consent cookie itself)
  - `analytics` , opt-in, off by default
- Consent state persists in the `cc_cookie` cookie for 365 days. `revision: 1` is the
  consent version: bump it when your cookie usage materially changes and every user is
  re-prompted.
- The modal copy interpolates `config.appName` and links `/privacy` and `/tos`.

## Why a feature flag instead of an env var

Consent requirements depend on where your users are, not on your deploy pipeline. The
flag lets an admin enable the banner the day it becomes relevant (EU launch, legal
review) without a build. Seed the flag in `scripts/seed.ts` (`FLAGS` array) and apply
with `make db.seed` , idempotent.

## Wiring analytics to consent

Umami and Clarity are both loaded by `CookieConsentBanner` itself, not injected
statically in `__root.tsx`, via a shared `loadAnalytics()` that calls `loadUmami()`
and `loadClarity()`. When the flag is on, `onConsent`/`onChange` callbacks check
`CookieConsent.acceptedCategory('analytics')` and only then call `loadAnalytics()`;
rejecting after a prior accept clears `umami.*` and Clarity's (`_clck`, `_clsk`,
`CLID`) cookies and reloads the page (via the `analytics` category's `autoClear`
config) so neither tracker keeps running. When the flag is off, both load
unconditionally on mount , an explicit admin opt-out of the consent requirement,
not a gap. Any future analytics/tracking script should get its own `load*()`
function called from `loadAnalytics()` in `CookieConsentBanner.tsx`, not injected
unconditionally elsewhere.

## Customizing

All copy, categories, layout, and cookie lifetime live inline in
`CookieConsentBanner.tsx` (single-file component, no abstraction). Edit translations
under `language.translations.en`, add categories under `categories`, and mirror them
in the preferences modal `sections`.
