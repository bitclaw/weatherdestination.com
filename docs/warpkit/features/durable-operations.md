# Durable Operations

Multi-step operations that touch external systems (Stripe, S3, filesystem) need crash safety. If the server dies mid-operation, the work must resume on next boot rather than leaving data in a broken half-done state.

Warpkit's durable operation pattern backs each operation with a state machine in the shared Drizzle DB. Completed steps are timestamped; incomplete operations are picked up by a startup reconciler.

## Pattern overview

Each durable operation has:

- A **jobs table** in `src/lib/db/schema.ts` with per-step completion timestamps and a concurrency lease
- `createJob(params)` , inserts the job row and optionally sets a blocking flag on the user (e.g. `deletionPendingAt`)
- `runJob(jobId)` , acquires the lease, executes each step in order (skipping already-completed steps), releases the lease on every exit path
- `reconcilePending()` , called at server boot from `server/start.ts` to resume any jobs that were in progress when the server last stopped

## Reference implementations

**Account deletion** (`src/lib/operations/account-deletion.server.ts`) is the canonical job-table example.

Steps (each has a completion timestamp column):
1. Cancel Stripe subscription
2. Delete Stripe customer
3. Delete user data files
4. Delete user DB
5. Delete user row

```ts
// Enqueue (from a mutation):
import { createDeletionJob } from '@/lib/operations/account-deletion.server';

const job = await createDeletionJob({
  userId: user.id,
  stripeSubscriptionId: sub?.stripeSubscriptionId ?? null,
  stripeCustomerId: sub?.stripeCustomerId ?? null,
  initiatedBy: 'user'
});

// Startup reconciler, wired directly in server/start.ts:
const { reconcilePendingDeletions } = await import(
  '@/lib/operations/account-deletion.server'
);
await reconcilePendingDeletions();
```

**Billing reconciliation** (`src/lib/operations/billing-reconciliation.server.ts`) is a second, no-job-table variant: it has no per-step state machine, runs once at startup only (also wired directly in `server/start.ts`), fetches every subscription row, and syncs each against Stripe (authoritative). Use this shape when the operation is a single idempotent sync pass rather than a multi-step sequence that needs to resume mid-way.

## Step execution rules

- Steps that **succeed**: mark their completion timestamp, clear `lastError`
- Steps that **fail**: persist `lastError`, release lease immediately, return `false`
- There is no `failedAt` column , incomplete jobs are always retried on next boot
- A failing step does not roll back previous steps (operations are designed to be idempotent)

## Lease

`leaseExpiresAt` prevents two server instances from running the same job concurrently. Default TTL: 5 minutes. The reconciler skips jobs with an active (non-expired) lease.

## Adding a new durable operation

1. Add a jobs table to `src/lib/db/schema.ts` with:
   - `id`, `userId`, `createdAt`, `updatedAt`, `leaseExpiresAt`
   - One nullable timestamp column per step (e.g. `stripeDeletedAt`)
   - `lastError TEXT`

2. Create `src/lib/operations/my-operation.ts` with `createJob`, `runJob`, `reconcilePending`

3. In `runJob`: acquire lease at start, release in all exit paths (success, failure, throw), skip steps whose timestamp is already set

4. In `reconcilePending`: query for jobs where all step timestamps are null AND (lease is null OR lease expired)

5. Wire `reconcilePending()` into `server/start.ts` directly, calling it via a dynamic `import('@/lib/operations/my-operation.server')` (fire-and-forget `.then()`, not awaited , see the account-deletion/billing-reconciliation calls already there for the pattern). Not `src/start.ts`: Vite's import-protection plugin statically flags `.server.ts` dynamic imports there regardless of an `if (import.meta.env.SSR)` guard, since `start.ts` is a shared entry point the client bundler also inspects. `server/start.ts` is a plain Bun script never inspected by the client bundler at all , see the comment in `src/start.ts` for the precedent (this used to be wired through a `server/plugins/` Nitro plugin instead, but that mechanism never actually ran; see `docs/warpkit/features/jobs.md`'s "Why server/start.ts, not a Nitro plugin").

## When to use this pattern

Use durable operations when:
- The operation has 2+ steps that each touch an external system
- A partial failure leaves the user in a broken state
- The operation must eventually complete even if the server restarts mid-way

For single-step fire-and-forget work, use the [job queue](./jobs.md) instead.
