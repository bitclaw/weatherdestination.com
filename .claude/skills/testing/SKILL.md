---
name: testing
description: warpkit testing philosophy: real SQLite, no mocks for DB, makeTestDb() for all feature tests
user-invocable: true
---

# warpkit Testing Patterns

## Core Philosophy

**Use a real database. Mocks are a code smell.**

TypeScript types catch shape errors. They do not catch SQL bind parameter mismatches, missing migrations, wrong column names, or off-by-one in ORDER BY. Only running against a real DB catches those.

Mocking the DB produces tests that pass while the real code is broken. This has burned us before.

---

## The Standard Setup

`makeTestDb()` in `src/test/db.ts` creates a real in-memory SQLite DB with all migrations applied:

```ts
import { makeTestDb } from '@/test/db';

describe('items CRUD', () => {
  it('inserts and retrieves an item', () => {
    const db = makeTestDb();
    const id = crypto.randomUUID();
    db.run('INSERT INTO items (id, title) VALUES (?, ?)', [id, 'hello']);

    const row = db.query<{ id: string; title: string }, [string]>(
      'SELECT * FROM items WHERE id = ?'
    ).get(id);

    expect(row?.title).toBe('hello');
  });
});
```

Each test call to `makeTestDb()` returns a fresh isolated DB. No shared state between tests.

---

## What to Test

### Always test: migrations

```ts
describe('items migrations', () => {
  it('creates table on fresh DB', () => {
    const db = new Database(':memory:');
    runUserMigrations(db);
    const tables = db.query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='items'"
    ).all();
    expect(tables.length).toBe(1);
  });

  it('is idempotent: running migrations twice does not error', () => {
    const db = new Database(':memory:');
    runUserMigrations(db);
    runUserMigrations(db); // must not throw
  });
});
```

### Always test: all CRUD operations

For each operation: insert, select, update, delete. Test the happy path and any constraint that would silently misbehave (ordering, uniqueness, foreign keys).

### Ask before writing each test

> "What could silently regress here that TypeScript and a glance at the code wouldn't catch immediately?"

If the answer is nothing: don't write the test. Fixture size is a signal: if setup dwarfs assertion, the test has no value.

---

## What NOT to Test

- Server functions directly: they depend on request context (`getRequestHeaders`, `auth.api`). Extract pure DB logic into helpers if you need to test it.
- TypeScript types or Zod schemas in isolation: they validate themselves.
- Constants asserting a hardcoded value equals itself.
- Pass-through functions with no logic.

---

## Sanctioned Patterns , Don't Flag as Violations

When auditing/reviewing tests (including via a delegated subagent), these are already-correct patterns, not mocks-are-a-code-smell violations:

- **Injectable interfaces**: a hand-rolled fake object satisfying a type named `*Like` (e.g. `JobQueueLike`, `SchedulerLike`) or explicitly commented as an "INJECTABLE INTERFACE" is sanctioned dependency injection, not a DB mock. This applies when the real dependency is itself an already-tested external package (`@bitclaw/jobs`) , faking its interface tests *this* file's logic, not SQL correctness. Only flag mocks of `bun:sqlite`/Drizzle objects directly.
Found during a cross-repo audit (2026-07-02) where a delegated subagent flagged the injectable-interfaces pattern above as a violation, costing a manual re-verification pass to retract.

**Retracted (2026-07-05): a private `setupServer()` per test file is NOT safe here.** `src/test/setup.ts` calls `mswServer.listen()` globally via bun's test preload, so it is *always* active for every test run , a test file's own `setupServer().listen()` therefore always coexists with the shared server, not replaces it. MSW's Node interceptor patches `node:http` as a process-wide singleton; a second `setupServer()` instance's `listen()`/`close()` lifecycle stomps on that same patch, and its `afterAll` teardown can silently disable interception for every *other* test file that runs afterward in the same bun:test process (all files share one process by default). This was verified directly: adding a private `setupServer()` to one test file caused unrelated Stripe/Resend-mocked tests in other files to fail with real network errors, and reverting it fixed them. If a URL needs its own default response, add it to `src/test/msw/handlers.ts` and use `mswServer.use()` for per-test overrides, exactly like the Stripe/Resend defaults , do not introduce a second `setupServer()` instance.

---

## Test Fixtures and Injectable Parameters

- **Shared mock builders live outside `*.test.ts`.** A file like `src/test/fixtures.ts` (generic DB-row fixtures: `makeUser`, `makeSubscription`) or a feature-local one like `src/features/billing/server/stripe-test-fixtures.ts` (Stripe object mocks: `makeSession`, `makeCharge`) is not itself a test suite , it just won't run as one, since it doesn't match the `*.test.ts` filename bun looks for. Extract mock builders here once more than one test file needs them, instead of copy-pasting the same builder into each.
- **Inject config-derived values as an optional parameter with a real default**, when the real config is empty or non-deterministic under `bun test` (`import.meta.env` is `{}` in tests). `getPlanIdForPriceId(priceId, plans = config.stripe.plans)` in `src/features/billing/server/stripe-shared.server.ts` is the reference: tests pass a fixture with real price IDs, so the assertion can actually distinguish "correctly rejects unknown" from "always returns undefined" , testing against the empty test-env config alone can never tell those apart.

---

## Naming

```ts
describe('example_items CRUD', () => {
  it('inserts and retrieves an item', ...);
  it('deletes an item', ...);
  it('returns items ordered by created_at DESC', ...);
});
```

Pattern: `describe('<table> CRUD')` + `it('verb phrase describing behavior')`.

---

## Testing Outbound HTTP (MSW vs Bun.serve)

By default, Bun runs every test file in **one process**, sharing `globalThis` and the module cache (including `mock.module` registrations) across all of them , this is NOT per-file isolation. Verified directly: a `globalThis` key set in one file was readable from another, and a `mock.module()` override registered in one file leaked into a second file's import of the same specifier with no way to restore it (`mock.restore()` and re-registering `mock.module()` in `afterAll` both failed to undo the leak). `mswServer` in `billing.test.ts` is a different instance from `mswServer` in `auth.test.ts` only because MSW's own `afterEach(() => mswServer.resetHandlers())` cleans it up per-test , that's discipline, not process isolation.

The `--isolate` flag (fresh global object per file) closes both leaks, but running it across the whole suite roughly doubles test time. Prefer avoiding the leak surface entirely instead: **module-scope internal singletons get an optional injectable parameter with a real default, not a `globalThis`/`mock.module` seam.**

```ts
// src/server/require-user.ts
export const requireUser = async (
  getHeaders: () => Headers = getRequestHeaders,
  testDb?: (typeof import('@/lib/db'))['db']
) => {
  const headers = getHeaders();
  // ...
  const db = testDb ?? (await import('@/lib/db')).db;
  // ...
};
```

`require-gates.test.ts` (`requireUser`/`requireAdmin`) is the reference example: it passes `() => new Headers()` and an in-memory `testDb` straight in as arguments, same as `makeTestDb()` everywhere else in the suite. No `globalThis` write, no `mock.module()` call, no dependency on file run order or process isolation , ordinary parameter passing, matches this codebase's existing convention (`getPlanIdForPriceId(priceId, plans = config.stripe.plans)` in `src/features/billing/server/stripe-shared.server.ts`).

`mock.module()`/`globalThis` tricks stay reserved for genuine third-party packages with no injectable seam to add a parameter to. If you're tempted to reach for either on a module *this codebase* owns, add a parameter instead , it's less code, and it can't leak across files no matter how the test suite is invoked.

Note: default parameter expressions cannot contain `await`, even inside an `async` function (`SyntaxError: Cannot use 'await' within a parameter default expression` , confirmed against Bun 1.3.14). Give the override param no default (`testDb?: T`) and resolve it in the function body with `??`, as above.

Within a file, tests run sequentially. The global `afterEach(() => mswServer.resetHandlers())` in `src/test/setup.ts` cleans up overrides after each test. If a test throws outside Bun's harness (unhandled rejection, process.exit in third-party code), `afterEach` is skipped and a stale handler bleeds to the next test in that file. This is discipline, not construction.

**Rule: pick the right tool based on what you're mocking.**

| What you're mocking | Tool | Why |
|---------------------|------|-----|
| Third-party API (Stripe, Resend) | `mswServer.use()` | Safe default handler catches after reset |
| Outbound HTTP to user-controlled / arbitrary URL | `Bun.serve()` per test | No shared state, no afterEach dependency |
| Any custom HTTP server you control | `Bun.serve()` per test | Construction-level isolation |

### mswServer.use() — safe for third-party APIs

```ts
import { mswServer } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

it('handles Stripe 500', async () => {
  mswServer.use(
    http.get('https://api.stripe.com/v1/subscriptions/:id', () =>
      HttpResponse.json({}, { status: 500 })
    )
  );
  // after this test, afterEach resets to default Stripe handler — still safe
  const result = await getSubscription('sub_123');
  expect(result.ok).toBe(false);
});
```

Safe because after `resetHandlers()`, the default Stripe handler in `src/test/msw/handlers.ts` still responds. Never use `mswServer.use()` for a URL that has no default handler — after reset, `fetch()` goes to the real network.

### Bun.serve() — for outbound HTTP to arbitrary URLs

```ts
import { it, expect } from 'bun:test';

const withTestServer = async (
  html: string,
  fn: (url: string) => Promise<void>
): Promise<void> => {
  const server = Bun.serve({
    port: 0, // random available port
    fetch() {
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  });
  try {
    await fn(`http://127.0.0.1:${server.port}`);
  } finally {
    server.stop(true);
  }
};

it('scrapes og:image from HTML', async () => {
  await withTestServer(
    '<meta property="og:image" content="https://cdn.example.com/img.png" />',
    async url => {
      const result = await scrapeOgImage(url);
      expect(result).toBe('https://cdn.example.com/img.png');
    }
  );
});
```

`port: 0` lets the OS pick a free port. `server.stop(true)` waits for in-flight requests to finish. Localhost requests pass through MSW automatically (see `localHandlers` in `src/test/msw/handlers.ts`).

---

## Running Tests

```bash
bun test                    # all tests
bun test --watch            # watch mode
bun test src/features/...   # single file
make ci                     # full CI including tests
```
