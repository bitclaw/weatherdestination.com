# Plan Limits (Entitlements)

Per-plan resource caps enforced via `checkEntitlement(plan, limitKey, currentCount)` from `@/lib/entitlements`.

## How it works

Limits are defined in `config.ts` under `stripe.limits`:

```ts
// config.ts
export type PlanLimits = {
  maxNotes: number;
  maxFileUploads: number;
  maxApiKeys: number;
};

limits: {
  free: { maxNotes: 10, maxFileUploads: 10, maxApiKeys: 3 },
  solo: { maxNotes: 100, maxFileUploads: 100, maxApiKeys: 10 },
  pro:  { maxNotes: -1, maxFileUploads: -1, maxApiKeys: -1 },
  team: { maxNotes: -1, maxFileUploads: -1, maxApiKeys: -1 }
}
```

`-1` means unlimited. `checkEntitlement` returns `{ allowed, used, limit }`.

## Gate ordering

Fetch subscription **before** `withWriteLock` (read-only gate). Enforce the count **inside** the lock with a fresh DB read to avoid TOCTOU races:

```ts
// Before lock: read-only subscription lookup
const sub = await db.query.subscriptions.findFirst({
  where: eq(subscriptions.userId, user.id),
  columns: { plan: true }
});
const plan = (sub?.plan ?? 'free') as PlanKey;

return withWriteLock(user.id, () => {
  const userDb = getUserDb(user.id);
  const count = listItems(userDb).length;          // fresh count inside lock
  const { allowed, used, limit } = checkEntitlement(plan, 'maxNotes', count);
  if (!allowed)
    return err(ERROR_CODES.PLAN_LIMIT_EXCEEDED, `Limit: ${used}/${limit}.`);
  // ... write ...
});
```

## Adding a new limit key

1. Add the key to `PlanLimits` type in `config.ts`
2. Add values for all plans under `stripe.limits`
3. The key name is automatically available to `checkEntitlement` via `EntitlementResource`
