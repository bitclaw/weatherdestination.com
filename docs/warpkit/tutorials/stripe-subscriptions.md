# Stripe Subscriptions

Get paid. Warpkit handles checkout, billing portal, webhooks, and subscription gating.

## Setup

**1. Create products in Stripe dashboard**

Create one product per plan. Copy the price IDs.

**2. Set env vars**

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PRO_PRICE_ID=price_...
VITE_STRIPE_PRO_YEARLY_PRICE_ID=price_...
```

**3. Configure plans in `config.ts`**

```ts
stripe: {
  plans: [
    {
      id: 'pro',
      name: 'Pro',
      popular: true,
      description: 'Everything you need to run your SaaS.',
      features: ['Unlimited items', 'Priority support', 'API access'],
      recurring: {
        priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID ?? '',
        price: 29,
        yearlyPriceId: import.meta.env.VITE_STRIPE_PRO_YEARLY_PRICE_ID ?? '',
        yearlyPrice: 290,
      },
    },
  ] as StripePlan[],
},
```

## Checkout flow

The `<CheckoutButton>` component calls `createCheckoutSession` and redirects to Stripe:

```tsx
import { CheckoutButton } from '@/components/landing';

<CheckoutButton priceId={plan.priceId} interval="monthly">
  Get started
</CheckoutButton>
```

On success, Stripe redirects to `/billing?success=true`.

## Billing portal

Users manage their subscription at `/billing`. The `<BillingPage>` calls `createBillingPortal` and redirects to Stripe's hosted portal for upgrades, downgrades, and cancellations.

## Webhooks

The webhook handler lives at `POST /api/v1/stripe-webhook`. It processes:

- `checkout.session.completed`: create subscription record
- `customer.subscription.updated`: update plan / status
- `customer.subscription.deleted`: mark subscription cancelled
- `invoice.payment_failed`: mark subscription past_due

Stripe signature verification is built in. To test locally:

```bash
stripe listen --forward-to localhost:3000/api/v1/stripe-webhook
```

## Gating features by subscription

**In a server function:**

```ts
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { ERROR_CODES } from '@/lib/constants';

const sub = await db.query.subscriptions.findFirst({
  where: eq(subscriptions.userId, user.id),
});
const isPro = sub?.status === 'active';

if (!isPro) return err(ERROR_CODES.NO_SUBSCRIPTION, 'Pro plan required');
```

**In a component:**

```tsx
import { UpgradeGate } from '@/features/billing';

<UpgradeGate hasAccess={isPro}>
  <ProFeature />
</UpgradeGate>
```
