# Domain Events

Warpkit ships an in-process typed event bus for decoupled side effects: sending emails, enqueueing jobs, firing webhooks. Events are emitted after a write completes; handlers run in the same process, not in a worker.

## Emitting an event

```ts
import { emit } from '@/server/events';

// Inside a mutation, after the write succeeds:
await emit('account.deleted', { userId });
```

Always `await emit()`. Handlers run inside a `try/catch` internally, so a failing handler won't crash the request , but without `await`, errors are silently swallowed and handlers may not finish before the response returns.

## Registering a handler

Handlers live in `src/server/event-handlers.ts`, which is side-effect imported by `src/start.ts` on the SSR side. No manual registration beyond adding the `on()` call there.

```ts
// src/server/event-handlers.ts
import { on } from '@/server/events';

on('account.deleted', async ({ userId }) => {
  // send email, enqueue cleanup job, etc.
});
```

Multiple `on()` calls for the same event are allowed. Each handler runs independently , a failure in one does not prevent others from running.

## Adding a new event type

Three steps:

**1. Add to `DomainEventMap` in `src/server/events.ts`:**

```ts
export type DomainEventMap = {
  // existing events...
  'my.event': { userId: string; someField: string };
};
```

Emitting an event not in `DomainEventMap` is a TypeScript compile error.

**2. Register a handler in `src/server/event-handlers.ts`:**

```ts
on('my.event', async ({ userId, someField }) => {
  // side effect: email, job enqueue, webhook call, etc.
});
```

If no handler is needed yet, add a logger stub so emissions are traceable:

```ts
import { createLogger } from '@/lib/logger';
const log = createLogger({ module: 'event-handlers' });

on('my.event', async ({ userId }) => {
  log.info({ userId }, 'domain event: my.event (no handler yet)');
});
```

**3. Emit from a server function:**

```ts
await emit('my.event', { userId, someField });
```

## Current events

| Event | Payload | Handler |
|-------|---------|---------|
| `subscription.activated` | `userId, planId, email, name, amount, currency` | Receipt email, trial-expiry job |
| `purchase.completed` | `userId, email, name, amount, currency` | Receipt email |
| `account.deleted` | `userId` | Logger stub (no handler yet) |
| `credits.purchased` | `userId, amount` | Logger stub (no handler yet) |
| `admin.auto-promoted` | `userId, email` | Logger stub (no handler yet) |
| `admin.impersonation.started` | `adminUserId, targetUserId` | Logger stub (no handler yet) |
| `billing.refunded` | `userId, kind, amount` | Logger stub (no handler yet) |
| `billing.disputed` | `userId, amount` | Logger stub, error level (ops-visible, needs review) |

## What domain events are NOT

- **Not a job queue.** `emit()` runs handlers synchronously in the same request. For work that must survive a server restart, enqueue a job via `@/features/jobs/enqueue` from inside the handler.
- **Not cross-process.** Events do not survive a server restart. If the process dies mid-handler, the side effect is lost.
- **Not for auth lifecycle.** Signup side effects (welcome email, free credits) live in `databaseHooks.user.create.after` in `src/server/auth.ts` , not here. `DomainEventMap` has no auth events.
