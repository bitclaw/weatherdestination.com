---
name: architecture
description: warpkit architecture reference: where things live, why, and the boundaries between them
user-invocable: true
---

# warpkit Architecture

## Stack at a Glance

| Layer | Tool |
|-------|------|
| Runtime | Bun |
| Framework | TanStack Start (React SSR) |
| Routing | TanStack Router (file-based) |
| Server data | TanStack Query |
| ORM | Drizzle (shared SQLite) |
| User data | Per-user SQLite via `bun:sqlite` |
| Auth | better-auth (OTP / magic-link / social OAuth) |
| Billing | Stripe (subscriptions + one-time + credits) |
| Email | resend + nodemailer (React Email) |
| Observability | Sentry (`@sentry/react` + `@sentry/node`, optional) |
| Compiler | React Compiler (auto-memoizes, no manual useMemo/useCallback needed) |
| Linter | Biome |
| Tests | Bun test runner |

---

## Directory Map

```
warpkit/
├── config.ts                   # App config: rename, branding, Stripe plans, auth method
└── src/
    ├── server/
    │   ├── auth.ts             # better-auth instance + plugins
    │   ├── email.ts            # sendEmail() helper
    │   ├── email-templates.tsx # React Email components
    │   ├── events.ts           # Typed in-process event bus (emit/on)
    │   ├── event-handlers.ts   # Side-effect handlers (email on payment, etc.)
    │   ├── logger.ts           # Pino logger factory
    │   ├── rate-limit.ts       # createRateLimiter(): in-memory, IP-based
    │   ├── require-user.ts     # requireUser(): auth gate for server functions
    │   └── functions/          # Shared server functions (bootstrap, onboarding)
    ├── routes/
    │   └── api/
    │       ├── auth/$.ts             # better-auth catch-all
    │       └── v1/
    │           ├── lead.ts             # Public lead capture endpoint
    │           └── stripe-webhook.ts   # Stripe webhook handler
    ├── lib/
    │   ├── db/
    │   │   ├── index.ts            # Drizzle client (shared app DB)
    │   │   ├── schema.ts           # Drizzle schema (users, sessions, subscriptions, jobs)
    │   │   ├── user-db.ts          # Per-user SQLite connections + write locks
    │   │   ├── user-migrations.ts  # Migrations run on every user DB open
    │   │   ├── user-events.ts      # logUserEvent(): append-only audit log
    │   │   └── user-rate-limiter.ts # checkUserRateLimit(): DB-backed per-user limiter
    │   ├── operations/
    │   │   ├── account-deletion.server.ts # Durable deletion state machine
    │   │   └── billing-reconciliation.server.ts  # Startup Stripe sync (wired in server/start.ts)
    │   └── (cn.ts, seo.ts, auth-client.ts, ...)  # Utilities
    ├── features/               # Domain feature modules (see Feature Structure below)
    ├── pages/                  # Cross-feature pages (dashboard, settings, login)
    ├── routes/                 # TanStack Router file-based routes (thin wrappers)
    ├── components/             # Shared UI components
    ├── hooks/                  # Shared React hooks
    ├── test/
    │   ├── db.ts               # makeTestDb() + makeTestSharedDb(): real in-memory SQLite
    │   ├── fixtures.ts         # makeUser(), makeSubscription()
    │   └── msw/                # MSW server + Stripe API handlers
    └── router.tsx              # TanStack router entry (required by build)
```

---

## Per-User SQLite Architecture

Each user gets their own SQLite file at `data/users/<userId>/user.db`.

```ts
// Read
const db = getUserDb(user.id);
const items = db.query<Item, []>('SELECT * FROM items ORDER BY created_at DESC').all();

// Write: always use withWriteLock to serialize concurrent writes
return withWriteLock(user.id, () => {
  const db = getUserDb(user.id);
  db.run('INSERT INTO items (id, title) VALUES (?, ?)', [id, title]);
  return ok({ id, title });
});
```

Migrations run automatically on `getUserDb()`. Add new tables in `src/lib/db/user-migrations.ts`.

The shared DB (`meta.db`) holds: users, sessions, accounts, verifications, subscriptions, account_deletion_jobs, leads. Managed by Drizzle + migration files in `drizzle/`.

---

## Feature Structure

Every feature follows this layout:

```
src/features/my-feature/
├── index.ts                        # Barrel: public API of this feature
└── server/
    ├── my-feature.queries.ts       # Read-only server functions (GET)
    ├── my-feature.mutations.ts     # Write server functions (POST)
    ├── my-feature.rules.ts         # Pure predicates shared between queries/mutations
    └── my-feature-crud.test.ts     # Integration tests (real SQLite)
```

**queries.ts** , `createServerFn({ method: 'GET' })` only. No writes.
**mutations.ts** , `createServerFn({ method: 'POST' })` only. All writes go through `withWriteLock`.
**rules.ts** , Pure functions, no I/O, no server functions. Only create if shared between queries and mutations; inline otherwise.
**index.ts** , Only export what routes need. Never import feature internals from another feature.

---

## Canonical Server Function Pattern

```ts
import { randomUUIDv7 } from 'bun';
import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { logUserEvent } from '@/lib/db/user-events';
import { ERROR_CODES } from '@/lib/constants';
import { requireUser } from '@/server/require-user';

export const createItem = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ title: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      const id = randomUUIDv7();
      db.run('INSERT INTO items (id, title) VALUES (?, ?)', [id, data.title]);
      logUserEvent(db, 'item.created', { id });
      return ok({ id, title: data.title });
    });
  });
```

---

## Durable Operations Pattern

Multi-step cross-system operations (account deletion, billing reconciliation) use state machines backed by the shared Drizzle DB. They survive server crashes: the startup reconciler resumes incomplete jobs on next boot.

Pattern lives in `src/lib/operations/`. Each operation has:
- A jobs table in `src/lib/db/schema.ts` with per-step completion timestamps and a concurrency lease
- `createJob(params)` , inserts job, sets any access-blocking flag on the user row (idempotent)
- `runJob(jobId)` , acquires lease, executes each step skipping already-done ones, releases lease on every exit path
- `reconcilePending()` , called at startup via `import.meta.env.SSR` guard in `start.ts`

Steps that fail: persist `lastError`, release lease, return `false`. Reconciler retries on next boot and via the `account:reconcile-deletions` cron (every 15 min, `scheduler.server.ts`) , a permanently-failed deletion (e.g. Stripe down) isn't stuck until the next restart.
Steps that succeed: clear `lastError`. No `failedAt` , incomplete jobs are always retried.

**Account deletion** (`src/lib/operations/account-deletion.server.ts`): 4 steps , cancel Stripe sub, delete Stripe customer, delete user DB file, delete shared user row.

**Billing reconciliation** (`src/lib/operations/billing-reconciliation.server.ts`): no job table. Runs at startup only (wired directly in `server/start.ts`, not a cron , see that file's fire-and-forget `.then()` calls), fetches all subscription rows, syncs each against Stripe. Stripe is authoritative. Handles `resource_missing` (revoke access), non-fatal errors (log + continue), and `hasAccess` drift.

---

## Domain Events

In-process typed event bus for side effects (email, webhooks, etc.).

```ts
import { emit } from '@/server/events';

// Inside a mutation, after the write:
await emit('payment.succeeded', { userId, amount });
```

Register handlers in `src/server/event-handlers.ts`:

```ts
import { on } from '@/server/events';

on('payment.succeeded', async ({ userId, amount }) => {
  await sendEmail({ ... });
});
```

Always `await emit()`. Handlers run in a try/catch internally , errors are caught and logged without crashing the request , but without `await`, handler errors are silently swallowed and handlers may not complete before the response returns. Not durable , events are lost on restart. Use durable operations pattern for correctness-critical flows.

---

## Rate Limiting

**IP-based (public endpoints):**

```ts
import { createRateLimiter } from '@/server/rate-limit';

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });
export const myFn = createServerFn({ method: 'POST' }).handler(async () => {
  if (limiter.check()) return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
});
```

**Per-user DB-backed (authenticated mutations):**

```ts
import { checkUserRateLimit } from '@/lib/db/user-rate-limiter';
import { logUserEvent } from '@/lib/db/user-events';

return withWriteLock(user.id, () => {
  const db = getUserDb(user.id);
  if (checkUserRateLimit(db, 'item.created', { windowMs: 60_000, max: 20 }))
    return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
  // ... write ...
  logUserEvent(db, 'item.created');
  return ok({ id });
});
```

`checkUserRateLimit` and `logUserEvent` are no-ops outside `NODE_ENV=production`.

---

## Auth

`requireUser()` is the auth gate , call at the top of every authenticated server function. Returns `session.user` or `null`. If null, return `err('UNAUTHORIZED', ...)` immediately.

Bootstrap (`src/server/functions/bootstrap.ts`) also checks `deletionPendingAt` , returns `err('ACCOUNT_DELETION_PENDING', ...)` if set, which the root layout renders as a dedicated "deletion in progress" screen.

---

## Billing Access

```ts
import { getSubscription } from '@/features/billing';

const sub = await getSubscription();
const isPro = sub?.data?.status === 'active';
```

Gate UI with `<UpgradeGate hasAccess={isPro}>`. Gate server functions by checking `users.hasAccess` from the shared DB. `users.hasAccess` is a read cache , Stripe is authoritative. The billing reconciler keeps them in sync.

---

## Routes

TanStack Router uses file-based routing. Layout routes:
- `_app.tsx`: authenticated app shell (redirects to login if no session)
- `_auth.tsx`: unauthenticated shell (login page)

Add a new page: create `src/routes/_app.mypage.tsx`. TSR generates the route tree automatically.

---

## Key Invariants

1. Every server function calls `requireUser()` before touching data.
2. All user DB writes go through `withWriteLock(user.id, fn)`.
3. Client code never imports from `src/server/` or `src/lib/db/`.
4. Feature internals never leak , only `index.ts` is imported by routes.
5. Server functions return `ok(data)` or `err('CODE', 'message')`. Never throw.
6. Tests use real in-memory SQLite via `makeTestDb()` / `makeTestSharedDb()`. No DB mocks.
