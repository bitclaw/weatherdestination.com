# Configuration

All user-facing configuration lives in `config.ts` at the repo root. Edit this file to rebrand and configure your SaaS.

## App identity

```ts
appName: 'MyApp',
appDescription: 'Your SaaS description here.',
domainName: 'myapp.com',
```

Used in email templates, SEO tags, footer, and throughout the UI.

## SEO

```ts
seo: {
  defaultTitle: 'MyApp: Your tagline here',
  defaultDescription: 'Your SaaS description here.',
  defaultOgImage: '/og-image.png',
  twitterHandle: '@myapp',
},
```

Place `og-image.png` in `/public`. Dimensions: 1200×630px.

## Email

```ts
resend: {
  fromEmail: 'noreply@myapp.com',
  fromName: 'MyApp',
},
```

## Stripe plans

Plans are defined as a `StripePlan[]` array. Each plan needs an `id` that matches the `PlanId` union type in `config.ts`.

```ts
// config.ts
export type PlanId = 'solo' | 'pro' | 'team';

const stripePlans: StripePlan[] = [
  {
    id: 'solo',
    name: 'Solo',
    description: 'Perfect for indie hackers and solo founders.',
    features: ['5 items', 'Email support', 'API access'],
    recurring: {
      priceId: import.meta.env.VITE_STRIPE_SOLO_PRICE_ID ?? '',
      price: 9,
      yearlyPriceId: import.meta.env.VITE_STRIPE_SOLO_YEARLY_PRICE_ID ?? '',
      yearlyPrice: 90,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    popular: true,                    // shows "Most popular" badge
    description: 'Everything you need to grow.',
    features: ['Unlimited items', 'Priority support', 'API access'],
    recurring: {
      priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID ?? '',
      price: 29,
      yearlyPriceId: import.meta.env.VITE_STRIPE_PRO_YEARLY_PRICE_ID ?? '',
      yearlyPrice: 290,
    },
    oneTime: {
      priceId: import.meta.env.VITE_STRIPE_ONE_TIME_PRICE_ID ?? '',
      price: 199,
    },
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For teams that need collaboration and scale.',
    features: ['Unlimited items', 'Dedicated support', 'Team seats'],
    recurring: {
      priceId: import.meta.env.VITE_STRIPE_TEAM_PRICE_ID ?? '',
      price: 79,
      yearlyPriceId: import.meta.env.VITE_STRIPE_TEAM_YEARLY_PRICE_ID ?? '',
      yearlyPrice: 790,
    },
  },
];
```

The pricing page (`<LandingPricing>`) renders plans from this array automatically and adapts the grid layout based on plan count (1, 2, or 3+ plans).

### Adding or removing plans

1. Add/remove entries from `stripePlans` in `config.ts`
2. Update `PlanId` to include/remove the new id
3. Add corresponding env vars to `.env` and `src/env.d.ts`
4. Create matching products/prices in Stripe dashboard

### Billing mode

Set `VITE_BILLING_MODE` to `subscription` (default) or `one_time`. In `one_time` mode, only `plan.oneTime` price IDs are used and the Free tier is hidden from the pricing page.

## Auth

```ts
auth: {
  loginUrl: '/login',
  callbackUrl: '/dashboard',
  verificationMethod: 'otp',    // 'otp' | 'magic-link' | 'both'
  turnstile: {
    enabled: Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY),
    siteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '',
  },
},
```

Override `verificationMethod` via `VITE_AUTH_VERIFICATION_METHOD` env var.

## Legal

```ts
legal: {
  companyName: 'MyApp Inc.',
  companyEmail: 'legal@myapp.com',
  effectiveDate: '2026-01-01',
  jurisdiction: 'United States',
},
```

Used in `/privacy` and `/tos` pages.

## Customer support (Crisp)

```ts
crisp: {
  id: import.meta.env.VITE_CRISP_WEBSITE_ID ?? '',
},
```

Set `VITE_CRISP_WEBSITE_ID` to enable the Crisp chat widget on all authenticated pages.

## Theme

Colors, border radius, and fonts are CSS variables in `src/styles.css`. To apply a shadcn preset:

```bash
bun run theme <preset-id>
```

Browse presets at [ui.shadcn.com/create](https://ui.shadcn.com/create).

## AI chat

```ts
ai: {
  model: 'openrouter/auto',
  systemPrompt: 'You are a helpful AI assistant.',
  localModel: true,
},
```

- `model`: OpenRouter model ID. `openrouter/auto` routes to the best available model.
- `systemPrompt`: System prompt prepended to every conversation.
- `localModel`: Show Chrome built-in LLM toggle when available. Requires an Origin Trial token in production (see `docs/warpkit/features/ai-chat.md`). Set to `false` for cloud-only.

Requires `OPENROUTER_API_KEY` env var to be set.

## Credits

```ts
credits: {
  enabled: true,
  freeCreditsOnSignup: 10,
  topUpPriceId: import.meta.env.VITE_STRIPE_CREDITS_PRICE_ID ?? '',
  creditsPerTopUp: 100,
},
```

- `enabled`: Toggle the entire credits system. When false, `deductCredit` always returns ok.
- `freeCreditsOnSignup`: Credits granted to new users at account creation.
- `topUpPriceId`: Stripe one-time price ID for credit top-ups. Set via `VITE_STRIPE_CREDITS_PRICE_ID`.
- `creditsPerTopUp`: Credits added per top-up purchase.

## Feature flags

Runtime toggles for features that can be disabled per deployment:

```bash
# Stable features: on by default, opt-out with =false
FEATURE_BLOG=false
FEATURE_LEADS=false
```

`isEnabled('blog')` and `isEnabled('leads')` in `src/lib/feature-flags.ts` read these at runtime.

## Operational env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `LOG_LEVEL` | `info` | Pino log level: `silent`, `error`, `warn`, `info`, `debug`, `trace` |
| `EMAIL_PROVIDER` | `resend` | Email backend: `resend` or `smtp` |
| `USER_DATA_DIR` | `data/users` | Directory for per-user SQLite files |
| `BETTER_AUTH_URL` | `https://<domainName>` | Public base URL; used in email links and Stripe redirect URLs |
