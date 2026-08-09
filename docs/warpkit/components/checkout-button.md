# Checkout Button

Initiates a Stripe checkout session and redirects the user to the Stripe-hosted payment page.

## Usage

```tsx
import { CheckoutButton } from '@/components/landing/checkout-button';

<CheckoutButton priceId={plan.priceId} interval="monthly">
  Get started
</CheckoutButton>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `priceId` | `string` | Stripe price ID |
| `interval` | `'monthly' \| 'yearly'` | Billing interval |
| `children` | `ReactNode` | Button label |

## What it does

1. Calls `createCheckoutSession({ priceId, interval })`
2. On success: redirects to `session.url` (Stripe checkout)
3. On error: shows error toast

After payment, Stripe redirects to `/billing?success=true`.

## File

`src/components/landing/checkout-button.tsx`
