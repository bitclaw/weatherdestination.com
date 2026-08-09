# Performance Benchmarks

Application-level load test results using `@bitclaw/loadtest` against a production build (`make prod.cluster`).

These are **relative-comparison** numbers (before/after an optimization on the same box), not absolute capacity guarantees. Read the caveats below before quoting any figure externally.

## 2026-07-19: this document was rewritten from scratch

Every number that ever appeared in this doc before today measured the wrong thing. Two independent bugs in the load-test harness meant every "authenticated" request was either hitting a cold DB path or silently redirecting to `/login` and getting counted as a passing `200`. Both are now fixed; the numbers below are the first trustworthy benchmark in this project's history. Full postmortem at the bottom, under [What was wrong before today](#what-was-wrong-before-today) - worth reading once, mostly so nobody re-introduces either bug.

## Known gap: deploy-overlap / job-queue-startup concurrency is not covered

Every run in this file exercises a single, already-running server via HTTP
load. It never simulates a rolling zero-downtime deploy (new process starts
and opens its DB handles before the old one stops - both briefly run at once)
or job-queue startup racing another process for the same SQLite files. That's
exactly the class of bug that hit runmist (this template's downstream fork)
in production: `SQLiteError: database is locked` from `getJobQueue()` on
deploy, root-caused to a SQLite pragma-ordering bug fixed in
`@bitclaw/jobs@2.1.3`/`@bitclaw/sqlite@1.5.1` and ported here. A real
regression test for this class of bug would need to spin up two overlapping
`server/start.ts` processes against shared `data/` files and assert neither
crashes - not more concurrent HTTP load, which this file already covers well.
Not built yet; flagged here as a follow-up.

## Test Setup

```bash
# Terminal 1 - start clustered production server
LOADTEST_AUTH_ENABLED=true LOADTEST_EMAIL=loadtest@example.com LOADTEST_OTP=loadtest123 make prod.cluster

# Terminal 2 - seed the 1000-user pool (must run under NODE_ENV=production - see below)
make loadtest.seed

# Terminal 2 - run load test
LOADTEST_EMAIL=loadtest@example.com LOADTEST_OTP=loadtest123 bun run test:load
bun run test:load:admin
```

`make loadtest.seed` forces `NODE_ENV=production` internally now - seeded session cookies must be signed the same way the production server that will read them expects, or every authenticated request silently redirects to `/login` (see the postmortem).

---

## Test Environment Caveats

Read these before trusting any number here.

- **WSL2, not bare metal.** All runs are on WSL2 (virtual disk + virtual network stack) on Windows. A real Linux VPS will produce different numbers - possibly better (no virt overhead) or worse (fewer/slower cores). Do not quote these as VPS capacity.
- **Run-to-run variance is real and can be large if the host isn't idle.** A same-day re-run of this exact baseline swung wildly (Landing page 2,857 → 10,670 req/s) because of unrelated load on the machine during the first attempt - confirmed by the fact that Landing page (pure `Bun.file()` I/O, untouched by anything in this doc) moved just as much as every authenticated endpoint. That's the tell: if the static landing page number is off from prior runs, the host was busy, not the app. `repeat: 3` (median + CoV%) is the mitigation - treat any delta below the reported CoV% as noise, and treat a run where Landing page itself looks off as unreliable regardless of what the other rows say.
- **Multi-tenant, not single-user.** 1000 distinct users (`make loadtest.seed`), each with their own `data/users/<id>/user.db`. Workers distribute across the full pool via `cookiePool` in `@bitclaw/sqlite`. This has been the methodology since before today's rewrite and remains correct - it was the *auth layer* that was broken, not the multi-tenant setup.
- **TTLCache staleness is a correctness tradeoff, not free.** Subscription + feature-flag caches are 30s TTL, bootstrap cache 10s, each independent per worker. A plan/flag change propagates staggered across the 12 workers, up to 30s. Fine in practice, but it is a tradeoff the throughput numbers are buying.
- **Thresholds are application defaults** (`@bitclaw/loadtest`): P95 ≤ 500ms, success ≥ 95%, throughput ≥ 50 req/s at lowest concurrency.

---

## 2026-07-19 - First trustworthy baseline

### Hardware

| Spec | Value |
|------|-------|
| CPU | AMD Ryzen 5 5600T, 6 cores / 12 threads @ 3500 MHz |
| RAM | 32GB (25GB available) |
| OS | Linux 6.6.114 (WSL2 on Windows) |
| Runtime | Bun v1.3.14 |
| Workers | 12 (one per logical core via `availableParallelism()`) |

### Configuration

Current architecture, established over the project's history (mechanisms unaffected by today's auth-cookie fix, see [Approaches Considered and Rejected](#approaches-considered-and-rejected) for what was tried and rejected along the way):

- `reusePort: true` on `Bun.serve` - kernel load-balances across 12 real OS worker processes (`Bun.spawn`, not threads)
- `ssr: 'data-only'` on the `_app` layout route - server-side React rendering skipped entirely; thin shell + dehydrated JSON sent instead
- Bootstrap `TTLCache` (10s, keyed on `userId`) in `getBootstrapDataFn` - skips two Drizzle queries (`users`, `subscriptions`) on cache hit
- better-auth `cookieCache` (5 min) - session reads a signed cookie instead of hitting `sessions`/`users` tables, when the cookie is present and correctly named (see postmortem)
- WAL mode + `synchronous=NORMAL` + `mmap_size=256MB` on all per-user SQLite DBs
- Landing page (`/`) prerendered static HTML - zero SSR cost

### Results (repeat=3, full mode, 1000-user pool)

**Main suite:**

| Endpoint | Conc | Req/s | P50ms | P95ms | P99ms | Success | AvgBody | CoV% |
|----------|-----:|------:|------:|------:|------:|--------:|--------:|-----:|
| Login page | 10 | 1,238 | 6.8 | 18.0 | 26.2 | 100.0% | 8.5KB | ±4% |
| Login page | 50 | 1,803 | 25.3 | 54.9 | 74.6 | 100.0% | 8.5KB | ±6% |
| Login page | 100 | 2,409 | 37.3 | 80.2 | 111.8 | 100.0% | 8.5KB | ±3% |
| Landing page | 10 | 8,611 | 0.6 | 4.3 | 6.6 | 100.0% | 75.4KB | ±2% |
| Landing page | 50 | 12,181 | 3.4 | 9.2 | 12.2 | 100.0% | 75.4KB | ±0% |
| Landing page | 100 | 10,670 | 8.8 | 17.2 | 21.7 | 100.0% | 75.4KB | ±3% |
| Dashboard | 10 | 806 | 10.8 | 27.3 | 37.8 | 100.0% | 6.8KB | ±2% |
| Dashboard | 50 | 1,780 | 24.1 | 61.3 | 84.9 | 100.0% | 6.8KB | ±3% |
| Dashboard | 100 | 2,081 | 43.7 | 91.2 | 128.0 | 100.0% | 6.8KB | ±2% |
| Billing | 10 | 593 | 15.8 | 30.7 | 40.4 | 100.0% | 7.3KB | ±2% |
| Billing | 50 | 1,088 | 42.0 | 90.1 | 116.7 | 100.0% | 7.3KB | ±1% |
| Billing | 100 | 1,229 | 74.6 | 157.8 | 205.7 | 100.0% | 7.4KB | ±1% |
| Settings | 10 | 1,100 | 8.0 | 19.0 | 24.6 | 100.0% | 7.4KB | ±5% |
| Settings | 50 | 1,614 | 28.5 | 61.2 | 87.7 | 100.0% | 7.4KB | ±3% |
| Settings | 100 | 1,886 | 48.1 | 103.7 | 142.4 | 100.0% | 7.4KB | ±2% |

**Admin Analytics** (single authenticated admin session, shared-DB aggregation cost over `subscriptions`/`payments`/`mrr_snapshots`):

| Endpoint | Conc | Req/s | P50ms | P95ms | P99ms | Success | AvgBody | CoV% |
|----------|-----:|------:|------:|------:|------:|--------:|--------:|-----:|
| Admin Analytics | 10 | 727 | 12.7 | 25.6 | 32.8 | 100.0% | 8.5KB | ±4% |
| Admin Analytics | 50 | 1,423 | 31.7 | 70.4 | 93.8 | 100.0% | 8.5KB | ±2% |
| Admin Analytics | 100 | 1,645 | 54.8 | 124.1 | 166.1 | 100.0% | 8.5KB | ±1% |

Thresholds: P95 max 500ms, min success 95%, min throughput 50 req/s. All passed, 100% success across every scenario, CoV ±0-6% throughout - a clean, low-noise run.

### Analysis

**Body sizes finally differ by endpoint, and that's the tell this run is real.** Dashboard 6.8KB, Billing/Settings 7.3-7.4KB, Login/Admin Analytics 8.5KB - genuinely different dehydrated payloads per route. Every prior "successful" run in this project's history showed a uniform ~8.5KB across every authenticated endpoint, because every authenticated endpoint was actually serving the same login page. Verified directly: dehydrated bootstrap data in the response body contains the real seeded user's email and name, not a redirect.

**Billing is the slowest authenticated endpoint, and that now makes architectural sense.** 1,229 req/s vs Dashboard's 2,081 and Settings' 1,886 at c=100 - Billing's route `loader` prefetches `subscriptionQueryOptions` server-side on top of the shared bootstrap fetch every other authenticated page also pays; Settings has no loader at all. This is the same explanation the project's very first (since-discarded) benchmark attempt gave for an analogous gap - it was directionally right even though its underlying numbers weren't trustworthy.

**Admin Analytics sits between Dashboard and Settings**, consistent with "a few small aggregate queries over a few hundred rows" being cheap relative to the SSR/loader machinery that already dominates authenticated-page cost.

**No optimization work happened between this run and the previous (invalid) one** - this is purely the harness bugs being fixed. Any future entry in this doc should diff against *this* baseline, not anything before it.

---

## Approaches Considered and Rejected

### Full CSR (SPA mode) for dashboard routes

Considered replacing `ssr: 'data-only'` with full client-side rendering via TanStack Start's SPA mode.

**What it would change:**

| | `ssr: 'data-only'` (current) | Full CSR |
|---|---|---|
| Initial HTML request | Thin shell + dehydrated JSON | Static shell only |
| Data on first render | Already in HTML (dehydrated) | Requires N client-side `/_serverFn/` calls |
| Auth redirect | Server-side, instant | Client-side, user sees spinner first |
| Total server work per page load | 1 request (bootstrap + loader bundled) | 1 static serve + N API round-trips |

**Why rejected:** The load test numbers would look dramatically better (static serving vs SSR) but the improvement is illusory. Bootstrap, subscription, and notification data still need to come from the server - they would just move from "bundled in the initial response" to separate client-initiated `/_serverFn/` requests. Net server load is the same or higher. Perceived performance is worse: users see a spinner while JS boots, then another wait while data fetches, vs the current approach where data arrives with the HTML. Auth redirects also regress (server can no longer redirect unauthenticated requests before the client receives anything).

`ssr: 'data-only'` is the correct middle ground: zero React rendering cost on the server, data dehydrated into the shell, auth enforced server-side.

### Streaming SSR (`defer()` + `<Await>`)

Considered as a way to overlap slow loader queries (e.g. Billing's `subscriptionQueryOptions` prefetch) with hydration instead of blocking the full response on the slowest query.

**Why rejected (for now):** `defer()`/`<Await>` streams by flushing a Suspense boundary mid-render during server-side rendering. `ssr: 'data-only'` skips server rendering entirely - there's no render pass to flush partial chunks into. Under the current rendering mode, deferring a loader promise degrades to "don't block the loader, let `useSuspenseQuery` fetch it client-side after hydrate" - the same effect as just not prefetching that query in the loader at all, achievable more simply by dropping the `prefetchQuery` call. Worth revisiting only if the rendering mode itself changes.

### Parallelizing `beforeLoad` and route `loader`

Considered whether the `_app` layout's `beforeLoad` (bootstrap fetch) and a matched route's own `loader` (e.g. Billing's subscription prefetch) could run concurrently instead of sequentially, since Billing's loader only touches `queryClient`, not any auth-derived context field.

**Why rejected:** Confirmed via direct instrumentation that TanStack Router runs these strictly serially - the loader's start timestamp lands within ~1ms of `beforeLoad`'s end timestamp on every request, every time. This is architectural, not incidental: a matched route's `loader` receives merged context from all ancestor `beforeLoad`s, so the framework requires them to complete first. Both calls are already TTLCached and cost single-digit-to-tens of ms warm; parallelizing them would save at most the smaller call's duration off P50 latency, not touch the actual c=100 concurrency ceiling. Not worth fighting the framework's execution model for.

---

## What was wrong before today

Two independent, compounding bugs in `scripts/seed-loadtest.ts` / `src/routes/api/loadtest/auth.ts` / `tests/load-test-admin.ts` meant every number in this document's history before 2026-07-19 was invalid. Kept here as a methodology postmortem, not as data to trust.

**Bug 1: missing `cookieCache` cookie.** The loadtest scripts signed only the `session_token` cookie, never better-auth's `cookieCache` cookie (`session_data`) that a real interactive login also sets. Without it, `auth.api.getSession()` fell through to two DB SELECTs (`sessions`, `users`) on every request, cache-hit or not - for the project's entire benchmarking history, including a 2026-06-13 entry that specifically claimed (and, via a real browser login, correctly verified) that an unrelated better-auth upgrade had eliminated those two SELECTs. That verification was real; it just never applied to this doc's own load-test traffic, which doesn't go through a real login. Fixed by signing a matching `session_data` cookie in the same HMAC/base64url format better-auth itself uses.

**Bug 2: missing `__Secure-` cookie prefix (much larger impact).** Under a production build (`NODE_ENV=production`, the default for `bun run start`/`start:cluster`), better-auth requires every session cookie to carry a `__Secure-` prefix whenever its `baseURL` resolves to an `https://` URL - which it always does in this app under a prod build, since `BETTER_AUTH_URL` isn't set in `.env` and `auth.ts` falls back to a placeholder `https://` domain outside dev mode. Every cookie the loadtest scripts hand-signed used the bare, unprefixed name. Consequence: `auth.api.getSession()` never found the cookie at all, on any worker, including the one that had just created the session two milliseconds earlier - `_app.tsx`'s `beforeLoad` then correctly redirected to `/login`.

This was initially misdiagnosed as a **cross-worker session-visibility race** - a plausible-looking theory, since the symptom (freshly-created session, unreadable on the very next request) is exactly what a WAL-visibility bug would look like, and it "reproduced" differently between `start` and `start:cluster` in informal testing. Direct reproduction with debug instrumentation disproved it: the failure is 100% deterministic given `NODE_ENV=production`, happens identically on a single process, and has nothing to do with which worker handles the request - it's a plain cookie-name mismatch. Confirmed by inspecting `getSignedCookie` in `better-auth`'s HTTP context layer directly: it computes the expected cookie name once (`__Secure-<prefix>.session_token`) and does a single exact-match lookup, no fallback.

**Why this went undetected for so long:** `@bitclaw/loadtest` follows redirects and only checks the final HTTP status code. A rejected session silently 307-redirects to `/login`, the tool follows it, gets a `200`, and counts it as a success - with a body indistinguishable from a real page unless you specifically compare body sizes across endpoints (they were suspiciously uniform - see the current run's Analysis section for what a real, differentiated set of body sizes looks like).

**Fix:** `src/lib/secure-cookie-prefix.server.ts` is now the single source of truth for this logic, mirroring `auth.ts`'s exact `isDev`/`baseURL` branching so it can't drift between `auth.ts` and the three loadtest call sites again. `make loadtest.seed` now forces `NODE_ENV=production` so seeded cookies always match what `prod.cluster` will actually check them against.

**Lesson for next time:** the diagnostic signal was there the whole time in the AvgBody column - every authenticated endpoint reporting an identical body size to the unauthenticated Login page is a redirect, not a coincidence. Cross-check body sizes across endpoints, not just success percentages, before trusting a "100% success" load test result.
