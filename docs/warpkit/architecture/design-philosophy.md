# Design Philosophy

Warpkit is a B2C SaaS starter. It is not an enterprise architecture showcase. Every decision optimizes for one thing: getting a working, trustworthy product in front of paying customers as fast as possible.

This page explains the core tradeoffs, what was chosen and why, and what Warpkit explicitly is not trying to be.

---

## The central bet: per-user SQLite

Most SaaS starters use a shared Postgres database with row-level multi-tenancy. Warpkit uses a separate SQLite file per user.

```
data/
  users/
    <userId>/
      user.db   ← every user's data lives here
  meta.db       ← shared: auth, sessions, subscriptions, jobs
```

**Why this works:**

- **Data isolation is free.** One user's data cannot leak to another through a missing `WHERE userId = ?`. The isolation is structural, not a discipline you maintain.
- **No multi-tenancy bugs.** The entire class of "accidentally returned another user's records" doesn't exist.
- **Portable backups.** A user's entire data is one file. Export, backup, and GDPR deletion are simple filesystem operations.
- **Zero infra cost at small scale.** No Postgres to run, no connection pool to configure. Start on a $5 VPS, scale until you have real revenue.
- **SQLite is fast.** For single-user read patterns (which is what most SaaS features are), SQLite with WAL mode outperforms a remote Postgres over the network.

**The tradeoff:**

- Cross-user queries (analytics, admin aggregates) require querying across files or maintaining a separate read model in `meta.db`.
- High write concurrency per user is serialized through `withWriteLock`. This is the right behavior for SQLite, and fine for typical SaaS workloads.
- At very high scale (thousands of writes/second per user), you'd want a different database. Most B2C SaaS products never reach this.

---

## Type-safe RPC with zero ceremony

Warpkit uses TanStack Start's `createServerFn` instead of REST controllers or GraphQL resolvers.

```ts
export const createItem = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ title: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err('UNAUTHORIZED', 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      db.run('INSERT INTO items (id, title) VALUES (?, ?)', [id, data.title]);
      return ok({ id, title: data.title });
    });
  });
```

No controllers. No DTOs. No dependency injection tokens. No decorators. The function is the endpoint. TypeScript catches mismatches between client call sites and server handlers at compile time.

---

## Real databases in tests

```ts
export const makeTestDb = (): Database => {
  const db = new Database(':memory:');
  runUserMigrations(db);
  return db;
};

export const makeTestSharedDb = () => {
  const sqlite = new Database(':memory:');
  migrate(db, { migrationsFolder: './drizzle' });
  return db;
};
```

Tests run against real in-memory SQLite instances with real migrations applied. No mocks for the database layer.

This catches real bugs: schema mismatches, migration ordering issues, constraint violations, and query correctness. Mock-based database tests pass when the real query is broken. Warpkit tests do not.

---

## Durability where incidents happen

Two classes of production incidents are handled structurally, not with try/catch and hope:

**Account deletion** (`src/lib/operations/account-deletion.server.ts`) is a multi-step operation spanning Stripe, the filesystem, and the shared database. If the server crashes between steps, the startup reconciler picks up where it left off. Steps are idempotent. A lease prevents duplicate execution.

**Billing reconciliation** (`src/lib/operations/billing-reconciliation.server.ts`) runs at startup (wired in `server/start.ts`, not inline in `src/start.ts` , see the comment there for why) and syncs every subscription row against Stripe's current state. Stripe is the source of truth. Webhooks are the fast path; the reconciler is the safety net for missed events.

These are not architectural ceremony. They exist because "server crashed mid-deletion" and "missed webhook left a canceled user with active access" are real production incidents that happen to every SaaS product eventually.

---

## What Warpkit is not

**Not an enterprise architecture.** There are no bounded contexts, no CQRS, no event sourcing, no aggregate roots, no domain rules objects. Business logic lives as functions. For a one- or two-developer SaaS at early scale, named domain rules and command/query separation add far more overhead than value.

**Not a distributed system.** Warpkit assumes single-instance deployment. The in-memory rate limiter doesn't survive restarts. The write lock is process-local. These are intentional constraints that simplify the system. If you need horizontal scaling, you'll know when you get there.

**Not a learning exercise.** The goal is not to demonstrate patterns. The goal is to ship a product buyers trust. Every abstraction in the codebase exists because removing it would cause a real problem, not because it follows a methodology.

---

## When to grow beyond Warpkit's patterns

The cliff is real. At some point, as a product grows, you'll want:

- Named domain invariants when business rules get complex enough to have edge cases worth naming
- Durable event delivery when fire-and-forget in-process events aren't safe enough for critical flows
- A read/write split when query complexity competes with write throughput
- Horizontal scaling when single-instance SQLite isn't enough

The right time to add these is when the problem actually exists, not before. Most B2C SaaS products fail before they reach the scale where these patterns become necessary. Ship first. Refactor when complexity demands it.

---

## The metric Warpkit optimizes for

**Time from `git clone` to first paying customer.**

Everything else is secondary.
