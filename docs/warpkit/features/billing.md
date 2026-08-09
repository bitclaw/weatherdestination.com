# Billing

Warpkit handles Stripe subscriptions end-to-end: checkout, billing portal, webhooks, and subscription gating.

## Architecture

- Subscription data stored in the shared DB (`subscriptions` table)
- Checkout creates a Stripe customer and session
- Webhook keeps subscription state in sync
- Billing portal lets users manage their plan

## Test-mode setup

```bash
make stripe.setup
```

Prompts for a Stripe secret key, then creates products/prices in that Stripe
account matching the plans in `config.ts` (Solo/Pro/Team monthly + yearly, the
one-time price, and the credits top-up price), and writes the resulting
`VITE_STRIPE_*_PRICE_ID` vars into `.env`. Safe to rerun , prices are tagged
with a deterministic `lookup_key` so existing prices are detected and reused
rather than duplicated (if the reused price's amount doesn't match `config.ts`,
you're prompted before it's reused). Refuses to run against a live secret key
(`sk_live_...`) without explicit confirmation.

Doesn't set `STRIPE_WEBHOOK_SECRET` , see [Local webhook testing](#local-webhook-testing) below for that.

To do this by hand instead: create the products/prices in the [Stripe
dashboard](https://dashboard.stripe.com/test/products) and paste the price IDs
into `.env` yourself, matching the `VITE_STRIPE_*_PRICE_ID` vars documented in
`.env.example`.

## Server functions

| Function | Method | Description |
|----------|--------|-------------|
| `getSubscription` | GET | Current user's subscription |
| `createCheckoutSession` | POST | Redirect to Stripe checkout |
| `createBillingPortal` | POST | Redirect to Stripe billing portal |

Queries in `src/features/billing/server/billing.queries.ts`, mutations in `src/features/billing/server/billing.mutations.ts`.

## Checkout

```ts
import { createCheckoutSession } from '@/features/billing';

const result = await createCheckoutSession({ priceId, interval: 'monthly' });
if (result.ok) window.location.href = result.data.url;
```

Or use the `<CheckoutButton>` component from `src/components/landing/checkout-button.tsx`.

## One-time purchase checkout

Set `VITE_BILLING_MODE=one_time` in `.env` and add a `oneTime` block to a plan in `config.ts`. Then trigger checkout:

```ts
import { createOneTimeCheckout } from '@/features/billing';

const result = await createOneTimeCheckout({ priceId });
if (result.ok) window.location.href = result.data.url;
```

After payment, the webhook sets `subscriptions.status = 'active'` and marks the purchase in the `purchases` table. Check access:

```ts
import { getOneTimePurchase } from '@/features/billing';

const purchase = await getOneTimePurchase();
const hasPurchased = purchase.ok && purchase.data !== null;
```

One-time mode has no trial support and no billing portal (nothing to manage after a single payment).

## Billing portal

```ts
import { createBillingPortal } from '@/features/billing';

const result = await createBillingPortal();
if (result.ok) window.location.href = result.data.url;
```

## Subscription gating

**Any paid plan (status check):**

```ts
import { ERROR_CODES } from '@/lib/constants';

const sub = await db.query.subscriptions.findFirst({
  where: eq(subscriptions.userId, user.id),
});
if (sub?.status !== 'active') return err(ERROR_CODES.NO_SUBSCRIPTION, 'Subscription required');
```

**Specific plan tier:**

```ts
// Require Pro or Team (not Solo)
const isPro = sub?.status === 'active' && (sub.plan === 'pro' || sub.plan === 'team');
if (!isPro) return err(ERROR_CODES.NO_SUBSCRIPTION, 'Pro plan required');
```

**Component:**

```tsx
import { UpgradeGate } from '@/features/billing';

<UpgradeGate hasAccess={sub?.status === 'active'}>
  <ProFeature />
</UpgradeGate>
```

## Webhook events handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription, one-time purchase, or credits grant (`stripe-checkout.server.ts`) |
| `customer.subscription.updated` / `customer.subscription.created` | Update plan and status (`stripe-subscription.server.ts`) |
| `customer.subscription.deleted` | Mark as cancelled (`stripe-subscription.server.ts`) |
| `invoice.payment_failed` | Mark as past_due (`stripe-subscription.server.ts`) |
| `invoice.paid` | Record a `payments` row for the admin analytics dashboard (`stripe-subscription.server.ts`) |
| `charge.refunded` | Claw back credits / revoke access (`stripe-refund.server.ts`); see [docs/warpkit/patterns/webhook-replay.md](../patterns/webhook-replay.md) |
| `charge.dispute.created` | Revoke access, log for admin review (`stripe-refund.server.ts`) |

Webhook entry point: `src/routes/api/v1/stripe-webhook.ts` → `handleStripeWebhook`/`routeStripeEvent` in `src/features/billing/server/stripe.server.ts`, which dispatches to the category-specific `stripe-*.server.ts` files above (see CLAUDE.md's Feature Structure section for the split convention).

**Before adding a new event handler or touching an existing field path** (e.g. `invoice.subscription`, `charge.invoice`), verify it against the actually-installed Stripe SDK version in `node_modules/stripe/cjs/resources/*.d.ts` rather than assuming from prior knowledge. This template hit two real Stripe API version mismatches in one session (`Invoice.subscription` moved to `invoice.parent.subscription_details.subscription`; `PaymentIntent`/`Charge` no longer expose an `invoice` field directly) , both caught by `make ci`'s typecheck, but cheaper to check first than to discover via a failed build.

## Local webhook testing

```bash
stripe listen --forward-to localhost:3000/api/v1/stripe-webhook
```

## Multi-tier plans

Add or remove entries from `stripePlans` in `config.ts`. The pricing page (`<LandingPricing>`) renders plans from this array and adapts the grid layout automatically.

When adding a new tier:
- Add the `id` to `PlanId` in `config.ts`
- Add the id to the `plan` enum in `src/lib/db/schema.ts`
- Add the id to the plan union in `src/lib/types/app.ts` and `src/server/functions/bootstrap.ts`
- Webhooks resolve plan id via `getPlanIdForPriceId()` in `src/features/billing/server/stripe-shared.server.ts` , no changes needed there

See [Configuration → Stripe plans](../configuration.md#stripe-plans) for the full plan shape.

## Free trial

Subscription mode only. One-time purchase mode has no trial support.

### Enable

```
# .env
VITE_TRIAL_DAYS=14
```

`VITE_TRIAL_DAYS` is read by `config.ts` into `config.billing.trialDays`. When set to a positive integer:

- Stripe checkout passes `subscription_data.trial_period_days`
- `trial_end` from Stripe is synced to `subscriptions.trial_ends_at` in the DB via both webhook and reconciliation
- Landing page pricing shows "Start 14-day free trial" button and updated subtitle
- Billing page shows "Trial ends [date]. No charge until after trial." instead of "Renews [date]"
- `PlanBadge` shows "Pro (trial)" during trial

### No-card trial (opt-in)

By default Stripe requires a card at checkout. To allow sign-up without a card:

```
VITE_TRIAL_NO_CARD=true
```

This sets `payment_method_collection: 'if_required'` on the checkout session. Most SaaS products keep card-required (default) to filter intent.

### Existing deployments

Add `VITE_TRIAL_DAYS` to your live `.env` (not just `.env.example`) and run `bun run db:migrate` to apply the `trial_ends_at` column migration before deploying.

### Trial state in DB

`subscriptions.trial_ends_at` (nullable integer timestamp). `subscriptions.status` = `'trialing'` while active. Webhook `customer.subscription.updated` transitions to `active` when trial ends. Reconciliation (`billing-reconciliation.server.ts`) also syncs this on each run.
