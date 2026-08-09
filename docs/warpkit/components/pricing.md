# Pricing

Renders Stripe pricing plans from `config.stripe.plans` with monthly/yearly toggle and checkout buttons. Supports 1, 2, or 3 subscription tiers, and a separate one-time purchase mode.

## Usage

```tsx
import { LandingPricing } from '@/components/landing/landing-pricing';

<LandingPricing />
```

## Modes

### Subscription (default)

`VITE_BILLING_MODE=subscription` (or unset).

- One card per plan in `config.stripe.plans` , no hardcoded Free card
- Monthly/yearly toggle via `<BillingIntervalToggle>`
- Grid adapts to plan count automatically:

| Plans in `config.ts` | Layout |
|---|---|
| 1 | Centered single card |
| 2 | 2-column |
| 3 | 3-column |
| 4+ | 4-column |

### One-time purchase

`VITE_BILLING_MODE=one_time`.

- Hides the Free card and interval toggle
- Single-card layout , designed for one product at one price (Basecamp Once / Shipfast style)
- Button shows "Buy once"
- Uses `plan.oneTime.priceId` from the plan config

## Plan config

Plans are defined in `config.ts`. The pricing grid renders whatever is in `config.stripe.plans`.

```ts
// 1-tier
const stripePlans: StripePlan[] = [
  {
    id: 'pro',
    name: 'Pro',
    popular: true,
    description: 'Everything you need.',
    features: ['Unlimited items', 'Priority support'],
    recurring: {
      priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID ?? '',
      price: 29,
      yearlyPriceId: import.meta.env.VITE_STRIPE_PRO_YEARLY_PRICE_ID ?? '',
      yearlyPrice: 290,
    },
  },
];

// 3-tier
const stripePlans: StripePlan[] = [
  { id: 'solo', name: 'Solo', recurring: { ... } },
  { id: 'pro',  name: 'Pro',  popular: true, recurring: { ... } },
  { id: 'team', name: 'Team', recurring: { ... } },
];

// One-time purchase (set VITE_BILLING_MODE=one_time)
const stripePlans: StripePlan[] = [
  {
    id: 'pro',
    name: 'Pro',
    description: 'Lifetime access.',
    features: ['Everything', 'Forever'],
    oneTime: {
      priceId: import.meta.env.VITE_STRIPE_ONE_TIME_PRICE_ID ?? '',
      price: 199,
    },
  },
];
```

## Trial CTA

When `config.billing.trialDays` is set (via `VITE_TRIAL_DAYS`), subscription mode shows:

- Subtitle: `"14-day free trial. Cancel anytime."`
- Button: `"Start 14-day free trial"` (per plan)

When unset: subtitle is `"Simple pricing. Cancel anytime."` and button is `"Get started"`.

One-time purchase mode is unaffected.

## Popular badge

Set `popular: true` on a plan to show the "Most popular" badge, inverted card colors, and a subtle scale-up.

## Files

- `src/components/landing/landing-pricing.tsx` , main component + exported `getPricingGridClass` helper
- `src/components/landing/billing-interval-toggle.tsx` , monthly/yearly toggle
- `src/components/landing/checkout-button.tsx` , initiates Stripe checkout
- `src/components/landing/landing-pricing.test.ts` , grid logic tests
