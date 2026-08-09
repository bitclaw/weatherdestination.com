# Credits

Per-call metering using a credit balance stored on the `users` table (shared DB). Atomic deduction ensures the balance never goes below zero without a race condition.

## Architecture

- Balance stored in `users.credits` (shared Drizzle DB, integer column)
- Deduction uses `UPDATE WHERE credits > 0 RETURNING` , single statement, no race
- Free credits granted on signup via `onUserCreated` in `src/server/auth-hooks.ts`, wired into the better-auth `user.create.after` hook in `src/server/auth.ts`
- Top-up via Stripe one-time payment (`mode: 'payment'`)

## Key files

| File | Purpose |
|------|---------|
| `src/features/credits/server/credits.server.ts` | `getCredits`, `deductCredit`, `addCredits` |
| `src/features/credits/server/credits.queries.ts` | `getCreditsFn` server function |
| `src/features/billing/server/stripe-checkout.server.ts` | `handleCreditsPurchase` grants credits on `checkout.session.completed` |
| `config.ts` | `credits.enabled`, `freeCreditsOnSignup`, `topUpPriceId`, `creditsPerTopUp` |

## Server functions

| Function | Method | Description |
|----------|--------|-------------|
| `getCreditsFn` | GET | Current user's credit balance |
| `buyCreditsCheckoutFn` | POST | Create Stripe checkout session for top-up |

## Gating a mutation

`deductCredit` operates on the shared DB, not per-user SQLite. Call it inside `withWriteLock` alongside the write it guards:

```ts
import { deductCredit } from '@/features/credits/server/credits.server';
import { db } from '@/lib/db';

return withWriteLock(user.id, async () => {
  const userDb = getUserDb(user.id);
  const deduct = await deductCredit(db, user.id);
  if (!deduct.ok) return err(ERROR_CODES.NO_CREDITS, 'No credits remaining');

  // ... metered operation ...
  return ok(result);
});
```

`deductCredit` is server-only , import directly, not via barrel (import protection blocks it in client bundles).

## Refunding a failed metered call

If credit was deducted but the metered operation never actually ran (e.g. the downstream API failed to even start), use `refundCredit(db, userId)` to give the credit back , same file, same import rule as `deductCredit`:

```ts
import { deductCredit, refundCredit } from '@/features/credits/server/credits.server';
import { db } from '@/lib/db';

return withWriteLock(user.id, async () => {
  const deduct = await deductCredit(db, user.id);
  if (!deduct.ok) return err(ERROR_CODES.NO_CREDITS, 'No credits remaining');

  try {
    const result = await startMeteredOperation();
    return ok(result);
  } catch (e) {
    await refundCredit(db, user.id);
    throw e;
  }
});
```

Reference implementation: `src/routes/api/v1/ai-chat.ts` refunds the credit when the OpenRouter stream fails to start. Only refund on a genuine "never happened" failure , don't refund for a partial/degraded response the user still received value from.

## Configuration

```ts
// config.ts
credits: {
  enabled: true,
  freeCreditsOnSignup: 10,
  topUpPriceId: 'price_xxx',   // VITE_STRIPE_CREDITS_PRICE_ID
  creditsPerTopUp: 100
}
```

Set `enabled: false` to disable the entire credits system. When disabled, the credits balance, settings page section, and top-up flow are all hidden.

## Top-up flow

1. User clicks top-up on `/dashboard/settings/credits`
2. `buyCreditsCheckoutFn` creates a Stripe `mode: 'payment'` session with `metadata.userId` and `metadata.amount`
3. On `checkout.session.completed`, `handleCreditsPurchase` in `stripe-checkout.server.ts` grants the credits inside a `db.transaction`: it dedups on `session.payment_intent` against the `purchases` table (insert a marker row) before incrementing `users.credits`, so a redelivered webhook can't double-grant. See [docs/warpkit/patterns/webhook-replay.md](../patterns/webhook-replay.md) for the full pattern.

## Free credits on signup

`config.credits.freeCreditsOnSignup` credits are added when a new account is created, via `onUserCreated` in `src/server/auth-hooks.ts` (called from the `user.create.after` hook in `src/server/auth.ts`).
