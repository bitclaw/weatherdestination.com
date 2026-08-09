# Webhook Replay

Stripe delivers webhooks **at least once** , not exactly once. Any handler for `checkout.session.completed`, `invoice.paid`, etc. can receive the same event twice (redelivery after a timeout, a retried delivery after your endpoint 500s, manual replay from the Stripe dashboard). A handler that isn't idempotent will double-grant credits, double-send receipt emails, or re-fire jobs on every replay.

There are two separate problems here, and they need two separate guards:

1. **The DB write must not double-apply.** Granting credits or upserting a subscription twice corrupts state.
2. **Side effects that aren't naturally idempotent** (sending an email, enqueuing a one-time job) must not re-fire on a replay even if the underlying write is safe to repeat.

## The rule

**Dedup the write** with a marker row checked and inserted in the same transaction as the mutation.
**Gate side effects** with a `isReplay` flag computed from a fresh read, so emits/emails only fire on the first delivery.

`make check-webhook-idempotency` enforces (at file-presence level) that `src/features/billing/server/stripe-*.server.ts` still contains both patterns , see the Makefile target for what it does and doesn't catch.

Note: `db.transaction()` on the shared Drizzle/bun-sqlite client only works correctly with a **synchronous** callback , see CLAUDE.md's "Shared-DB Transactions Must Use Sync Callbacks" section. Every example below uses `.sync()` on reads and `.run()` on writes, not `await`, for that reason.

## Right: dedup marker in the same transaction as the write

`handleCreditsPurchase` in `src/features/billing/server/stripe-checkout.server.ts` dedups on the Stripe payment intent ID. The marker insert and the credit increment happen inside the same `db.transaction`, so a crash between the two can't strand a marker without the grant (or vice versa):

```ts
let granted = false;
db.transaction(tx => {
  const existing = tx.query.purchases
    .findFirst({ where: eq(purchases.stripePaymentIntentId, paymentIntentId) })
    .sync();
  if (existing) return; // already granted, replay , no-op

  tx.insert(purchases).values({ /* marker row */ }).run();

  tx.update(users)
    .set({ credits: sql`credits + ${amount}`, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run();
  granted = true;
});

if (granted) {
  invalidateBootstrapCache(userId);
  await emit('credits.purchased', { userId, amount });
}
```

The `emit` only fires when `granted` is true , a replay short-circuits before it, so it can't be sent twice either.

## Right: isReplay flag for upserts where the write is naturally idempotent

`handleSubscriptionCheckout` (same file) upserts the subscription row with `onConflictDoUpdate` , the write itself is safe to repeat. But the `subscription.activated` emit (receipt email, trial-expiring job) must only fire once. The handler computes `isReplay` from a fresh read inside the transaction, before the upsert:

```ts
let isReplay = false;

db.transaction(tx => {
  if (subId) {
    const existingSub = tx.query.subscriptions
      .findFirst({
        where: eq(subscriptions.userId, userId),
        columns: { stripeSubscriptionId: true }
      })
      .sync();
    isReplay = existingSub?.stripeSubscriptionId === subId;
  }

  tx.insert(subscriptions)
    .values({ /* ... */ })
    .onConflictDoUpdate({ /* ... */ })
    .run();
});

invalidateSubscriptionCache(userId);
invalidateBootstrapCache(userId);

if (userEmail && !isReplay) {
  await emit('subscription.activated', { /* ... */ });
}
```

## Wrong: check-then-write outside the transaction

```ts
// WRONG , dedup read and write are not atomic; two concurrent redeliveries
// can both pass the findFirst check before either insert commits
const existing = await db.query.purchases.findFirst({
  where: eq(purchases.stripePaymentIntentId, paymentIntentId)
});
if (existing) return;

await db.insert(purchases).values({ /* marker row */ });
await db.update(users).set({ credits: sql`credits + ${amount}` });
```

Two redeliveries arriving close together can both read "no existing marker" before either write commits , the dedup check itself has a TOCTOU race unless it's inside the same transaction as the write it's guarding. See [gate-ordering.md](gate-ordering.md) for the general version of this rule.

## Adding a new webhook handler

1. Identify what must not double-apply (a DB write) vs what must not double-fire (an emit, an email, a job enqueue).
2. Dedup the write with a marker row (or a naturally-idempotent upsert) inside a `db.transaction`, using a synchronous callback (`.sync()`/`.run()`, no `await` inside).
3. If any side effect isn't safe to repeat, compute an `isReplay` flag from a fresh read inside that same transaction and gate the side effect on it.
4. Run `make check-webhook-idempotency` to confirm the new handler file still contains both required patterns (file-presence level , see the Makefile target for what it does and doesn't catch).
5. Reference implementation: `handleCreditsPurchase` and `handleSubscriptionCheckout` in `src/features/billing/server/stripe-checkout.server.ts`.
