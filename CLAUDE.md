# Warpkit: B2C SaaS Starter Template

Full-stack TypeScript SaaS template. Per-user SQLite databases, Stripe billing,
social + passwordless auth, file uploads, cookie consent, credits metering, dark mode,
onboarding flow. Clone, configure `config.ts`, ship.

## Tech Stack

| Concern | Tool |
|---------|------|
| Runtime | Bun |
| Framework | TanStack Start (React SSR) |
| Routing | TanStack Router (file-based) |
| Server data | TanStack Query |
| ORM | Drizzle (shared SQLite) |
| User data | Per-user SQLite via `bun:sqlite` |
| Auth | better-auth (OTP / magic-link / social OAuth) |
| Billing | Stripe (subscriptions + one-time + credits top-up) |
| File uploads | S3 presigned POST/GET, per-user SQLite metadata |
| Cookie consent | vanilla-cookieconsent, admin feature flag toggle |
| Email | resend + nodemailer (React Email) |
| Analytics | Umami + Microsoft Clarity (script tag, both optional) |
| Captcha | Cloudflare Turnstile (optional) |
| Observability | Sentry (`@sentry/tanstackstart-react`, optional) |
| Compiler | React Compiler (`babel-plugin-react-compiler`) |
| Linter | Biome |
| Tests | Bun test runner |
| Package manager | Bun |

## Directory Map

```
warpkit/
├── config.ts                   # App config: rename, branding, Stripe plans, auth method
└── src/
    ├── server/
    │   ├── auth.ts             # better-auth instance + plugins
    │   ├── auth-hooks.ts       # signup side-effect hooks (onUserCreated, onUserCreatedSafely)
    │   ├── require-user.ts     # requireUser() auth gate
    │   ├── require-admin.ts    # requireAdmin() admin gate
    │   ├── events.ts           # domain event bus: DomainEventMap, emit(), on()
    │   ├── event-handlers.ts   # registered domain event handlers (auto-imported by start.ts)
    │   ├── event-handler-utils.ts # shared helpers for event handlers
    │   ├── email.ts            # sendEmail() helper
    │   ├── email-templates.tsx # React Email components
    │   ├── rate-limit.ts       # createRateLimiter(): in-memory, IP-based
    │   └── functions/          # Shared server functions (bootstrap, onboarding)
    ├── lib/
    │   ├── db/
    │   │   ├── index.ts            # Drizzle client (shared app DB)
    │   │   ├── schema.ts           # Drizzle schema (users, sessions, subscriptions, account_deletion_jobs)
    │   │   ├── user-db.ts          # Per-user SQLite connections + write locks
    │   │   ├── user-migrations.ts  # Migrations run on every user DB open
    │   │   ├── user-events.ts      # logUserEvent(): append-only audit log
    │   │   └── user-rate-limiter.ts # checkUserRateLimit(): DB-backed per-user limiter
    │   ├── operations/
    │   │   └── account-deletion.server.ts # Durable deletion state machine
    │   └── (logger.ts, app-url.ts, cn.ts, seo.ts, auth-client.ts, ...)  # Utilities
    ├── features/
    │   ├── account/            # Account deletion state machine (durable, multi-step)
    │   ├── admin/              # User management, impersonation, admin guard + DataTable
    │   ├── ai-chat/            # SSE streaming chat via OpenRouter, per-user conversation DB
    │   ├── api-keys/           # Hashed key storage (SHA-256), plan-limited, touch tracking
    │   ├── apps/               # Static integration card grid
    │   ├── audit-log/          # Read-only per-user event viewer (own user_events only)
    │   ├── billing/            # Stripe checkout, portal, webhook handlers
    │   ├── blog/               # Markdown/JSON post renderer via content-collections
    │   ├── captcha/            # Cloudflare Turnstile wrapper
    │   ├── credits/            # Per-call metering: deduct, top-up, balance query
    │   ├── email-validation/   # Pre-submit email validator (disposable + MX), wired into login/signup forms
    │   ├── feature-flags/      # Admin-managed runtime flags + useFeatureFlag hook
    │   ├── feature-requests/   # User-facing voting board
    │   ├── jobs/               # SQLite-backed background job queue (@bitclaw/jobs)
    │   ├── notes/              # Reference: simple form CRUD pattern
    │   ├── notification-preferences/ # Per-user marketing email toggles
    │   ├── sidebar-preferences/     # Per-user sidebar item visibility
    │   ├── notifications/      # In-app notification system (mark read, mark all read)
    │   └── uploads/            # S3 file uploads: presigned URLs, metadata, delete
    ├── pages/                  # Cross-feature pages (dashboard, settings, login)
    ├── routes/                 # TanStack Router file-based routes + API server routes
    │   └── api/
    │       ├── auth/$.ts       # better-auth catch-all
    │       └── v1/
    │           ├── ai-chat.ts          # SSE streaming chat endpoint
    │           ├── lead.ts             # Public lead capture endpoint
    │           └── stripe-webhook.ts   # Stripe webhook handler
    ├── components/             # Shared UI components (includes cookie-consent/)
    ├── hooks/                  # Shared React hooks
    ├── test/
    │   ├── db.ts               # makeTestDb() (per-user), makeTestSharedDb() (shared Drizzle)
    │   ├── fixtures.ts         # makeUser(), makeSubscription() , shared test factories
    │   └── msw/                # MSW server + Stripe API handlers for billing tests
    └── router.tsx              # TanStack router entry (required by build)
```

## Key Architecture: Per-User SQLite

Each user gets their own SQLite file at `data/users/<userId>/user.db`. The shared DB (`meta.db`) holds users, sessions, subscriptions, jobs. Never mix the two clients , see `/architecture` skill for the full DB access table.

Migrations run automatically on `getUserDb()`. Each migration lives in its own file under `src/lib/db/migrations/` with a Laravel-style timestamp prefix.

**Adding a migration:**
1. Create `src/lib/db/migrations/YYYYMMDD_HHMMSS_description.ts` (use `date +%Y%m%d_%H%M%S` for the prefix)
2. Export a `migration` object with `id` (unique string) and `run(db)` function
3. Import it in `user-migrations.ts` and append to `USER_MIGRATIONS`

```ts
// src/lib/db/migrations/20260608_120000_add_widgets.ts
import type { Database } from 'bun:sqlite';

export const migration = {
  id: '010_add_widgets',
  run: (db: Database) => {
    db.run(`CREATE TABLE IF NOT EXISTS widgets (...)`);
  }
};
```

Migration string IDs in `_warpkit_migrations` must be preserved exactly once deployed. Existing user DBs depend on them.

## Key Patterns

> For canonical code examples (server fn, feature structure, auth, rate limiting, domain events, billing, drawers, validateSearch), load `/coding` or `/architecture` skills. This section documents rules and gotchas only.

### Server Functions

See `/coding` skill for the canonical pattern. Key rules:
- Always `requireUser()` first; return `err(ERROR_CODES.UNAUTHORIZED, ...)` if null
- All writes inside `withWriteLock(user.id, fn)`
- `logUserEvent` writes to per-user SQLite , only in mutations using `getUserDb()`. Shared-DB mutations (billing, credits, admin) have no equivalent audit call. This is intentional.
- Error codes in `src/lib/constants/errors.ts` , always use `ERROR_CODES.*`, never raw strings

**Exception: single-row UPDATE by PK** , `withWriteLock` may be omitted only when ALL of:
- Single row targeted by primary key (no reads, no range scans)
- Idempotent , safe to run concurrently or re-run
- Does not depend on current DB state (no check-then-write)
- Does not call `logUserEvent`

Reference: `touchApiKeyFn` in `src/features/api-keys/server/api-keys.mutations.ts`.

### Feature Structure

See `/coding` and `/architecture` skills for the full layout. Key rules:

**Deliberately feature-sliced, not tanstack.com's layer-based grouping.** tanstack.com's own repo
(`auth/`, `builder/`, `contexts/`, `blog/`, `db/`, `queries/`, `stores/`, `mcp/` at the `src/` root)
groups by technical layer, which fits a docs/marketing site with thin, mostly-independent pages.
This codebase organizes by domain instead (`src/features/<domain>/{queries,mutations,components}`)
because it's feature-rich, and feature-slicing is enforced by CI (barrel exports, `*.server.*`
import protection, `features/*/pages` routing). Restructuring toward tanstack.com's layout would be
pure churn with no functional gain and would break those CI-enforced conventions. The naming
alignment already in place (`router.tsx`, `start.ts`, `routes/`, `server/`, `components/`, `hooks/`)
is the useful part of "close to tanstack.com" — not a full architectural switch. (Decided
2026-08-01 after this came up with no prior recorded decision anywhere — write any future
reconsideration here too, not just in chat.)

**Barrel convention** (`index.ts` exports only):
- `createServerFn` results (queries + mutations)
- Query key factories and `queryOptions`
- Reusable UI components
- Public types

Page components (`pages/`) are NOT in barrels , routes import them directly. Server-only utilities (webhook handlers, SDK wrappers) also bypass the barrel.

**Splitting large `*.server.ts` webhook hubs:** once a webhook handler file exceeds ~400 lines, split along event-category boundaries into `<feature>-<category>.server.ts` files, keeping the original filename as a thin entry point (signature verification + event-type routing only). Extract cross-category helpers into `<feature>-shared.server.ts`. Reference: `src/features/billing/server/` , split into `stripe.server.ts` (entry/router), `stripe-shared.server.ts`, `stripe-checkout.server.ts`, `stripe-subscription.server.ts`, `stripe-refund.server.ts`.

**Search before creating a UI component:** before adding anything to `src/components/ui/` or a feature's `components/`, grep the shared `src/components/ui/index.ts` barrel and feature `components/` dirs for something that already covers the need. Reuse or extend over duplicating , a near-identical component under a new name is drift that never gets cleaned up. See `/coding` skill for the full rule.

**Search before writing a new doc, too:** before creating a new file under `docs/`, grep `docs/` for the topic first. Writing a second doc that partially overlaps an existing one is the same drift as a duplicate component , worse, because the two copies can (and did, once) disagree on a factual detail like which permission scope is required, with nothing forcing them back into sync.

**"Audit complete" requires enumerating every caller, not the first one found:** when verifying what an external API/SDK integration actually needs (permission scopes, required config, etc.), grep for every file that imports the client/SDK before declaring the list final , not just the first or most obvious file. A second file hitting a different endpoint of the same API is easy to miss and produces a confidently-wrong answer instead of an incomplete one.

**Page component placement:** Feature-local pages live inside their feature under `features/*/pages/`. Cross-feature shell pages (dashboard layout, settings shell, login) live in `src/pages/`.

**Import protection:** Vite blocks these paths from client bundles at build time:
- `**/*.server.*` (any file with `.server.` in the name)
- `**/lib/db/**` (all DB utilities)

`src/server/**` is also server-only by convention. Violations produce confusing build errors (`cannot find module`, empty chunks) rather than obvious type errors , the most common bundling footgun in this codebase.

When adding a new server-only utility: name it `*.server.ts` OR place it under `src/lib/db/` or `src/server/`. Import directly from mutations/queries, not through the feature barrel.

**`createServerFn` does NOT protect top-level imports.** TanStack Start replaces handler bodies with RPC stubs for the client bundle, but static top-level imports in the same file survive that transformation. If a queries/mutations file has a top-level import of a Node.js-only package, that package ends up in the client bundle and crashes the page with `node:child_process` / `node:util` errors at runtime.

Fix: use a dynamic import inside the handler body:
```ts
// WRONG , top-level import pollutes client bundle even with createServerFn
import { SomeServerLib } from 'server-only-pkg';
export const myFn = createServerFn().handler(async () => new SomeServerLib());

// RIGHT , dynamic import stays inside handler body, tree-shaken for client
export const myFn = createServerFn().handler(async () => {
  const { SomeServerLib } = await import('server-only-pkg');
  return new SomeServerLib();
});
```

`rollupOptions.external` in `vite.config.ts` mitigates this for production builds only , the Vite dev server does not respect it. The dynamic import fix works in both.

### Auth

`requireUser()` , auth gate, import from `@/server/require-user`. `requireAdmin()` , admin gate, import from `@/server/require-admin`. See `/architecture` skill for details.

**User lifecycle hooks:** `src/server/auth.ts` is the only correct place for side effects that fire on account creation. The `databaseHooks.user.create.after` hook runs for every signup path (OTP, magic-link, social OAuth).

Do NOT put signup side effects in server functions, domain event handlers, or route loaders , they miss signups or fire too broadly.

To add a signup side effect, extend the existing `after` hook in `src/server/auth.ts`. The hook uses a `globalThis` Set (`welcomeEnqueued`) to deduplicate job enqueues during HMR , apply the same pattern for any `enqueue()` call added there.

**Disposable-email gating:** the OTP and magic-link send handlers in `src/server/auth.ts` reject disposable addresses via `isDisposableEmail` from `@bitclaw/disposable-email` (throws before any email is sent). That inline check is the canonical, unconditional signup gate. The `email-validation` feature (`validateEmail` server fn: disposable + MX check, driven by `config.auth.disposableEmailCheck` / `config.auth.mxCheck`) is the pre-submit UX layer, wired into `handleEmailSubmit` in the login and signup pages. See `docs/warpkit/features/email-validation.md` before touching either.

**Social providers** (Google, GitHub) activate automatically when env vars are set , no code change required:

```bash
GOOGLE_CLIENT_ID=...   GITHUB_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=... GITHUB_CLIENT_SECRET=...
VITE_GOOGLE_CLIENT_ID=... VITE_GITHUB_CLIENT_ID=...  # needed so login page shows buttons
```

### Gate Ordering Rule

Not all pre-checks belong inside `withWriteLock`. See also: [docs/warpkit/patterns/gate-ordering.md](docs/warpkit/patterns/gate-ordering.md)

- **Read-only gates** (backup freshness, feature flag, credential existence, rate-limit reads) go **before** `withWriteLock`. Shouldn't hold the lock during slow work (S3 calls, external API checks).
- **Mutable state gates** (status checks, uniqueness constraints, resource availability) go **inside** `withWriteLock` with a fresh DB read. Without the lock, state can change between check and write (TOCTOU race).

```ts
// WRONG , mutable status check outside lock is a race
const project = db.query('SELECT status FROM projects WHERE id = ?').get(id);
if (project.status === 'deploying') return err('DEPLOYMENT_IN_PROGRESS', '...');
return withWriteLock(user.id, () => {
  db.run('UPDATE projects SET server_id = ?', [targetId]); // stale status!
});

// RIGHT , read-only gate outside, mutable gates inside with re-read
const backupOk = checkBackupFreshness(db, projectId); // read-only, can be slow
if (!backupOk) return err('BACKUP_REQUIRED', '...');

return withWriteLock(user.id, () => {
  const project = db.query('SELECT status FROM projects WHERE id = ?').get(id); // fresh read
  if (project.status === 'deploying') return err('DEPLOYMENT_IN_PROGRESS', '...');
  db.run('UPDATE projects SET server_id = ?', [targetId]);
});
```

### Shared-DB Transactions Must Use Sync Callbacks

`db.transaction(callback)` on the shared Drizzle/bun-sqlite client only works correctly with a **synchronous** callback , never `async tx => {...}`. Bun's native transaction wrapper does not await async callbacks: it calls the callback, and issues COMMIT as soon as that call returns , which for an async function is immediately, at its first internal `await`, before any later statements have run and with no rollback if the callback later throws. This silently breaks both atomicity and error rollback; it does not throw or warn.

All bun-sqlite/Drizzle calls are synchronous under the hood, so dropping `async`/`await` inside the callback works: use `.sync()` on `tx.query.*.findFirst()`/`findMany()` reads and `.run()` on `tx.insert()`/`.update()`/`.delete()` writes, no `await`.

```ts
// WRONG , COMMIT fires at the first await; the update below runs unprotected
// after commit, and a later throw here won't roll back the insert.
await db.transaction(async tx => {
  const existing = await tx.query.purchases.findFirst({ where: ... });
  if (existing) return;
  await tx.insert(purchases).values({ ... });
  await tx.update(users).set({ ... }).where(...);
});

// RIGHT , fully synchronous callback, real atomicity
db.transaction(tx => {
  const existing = tx.query.purchases.findFirst({ where: ... }).sync();
  if (existing) return;
  tx.insert(purchases).values({ ... }).run();
  tx.update(users).set({ ... }).where(...).run();
});
```

This only applies to the shared Drizzle client (`meta.db`). Per-user SQLite writes already use `withWriteLock`, not `db.transaction()`, for their write serialization , see the Gate Ordering Rule above.

### Domain Events

In-process typed event bus for side effects. See `/architecture` skill for code. Key rules:
- Always `await emit()` , without await, errors are silently swallowed and handlers may not complete before the response returns
- Add new event types to `DomainEventMap` in `src/server/events.ts`
- Register handlers in `src/server/event-handlers.ts` (auto-imported by `start.ts`)
- Multiple `on()` calls for the same event are allowed , each runs independently
- Webhook handlers that `emit()` on redeliverable events (Stripe, etc.) must guard against firing twice on replay , see [docs/warpkit/patterns/webhook-replay.md](docs/warpkit/patterns/webhook-replay.md)

### In-app Notifications

Persist a notification into the user's notification bell (per-user SQLite `notifications` table):

```ts
import { notify } from '@/lib/db/notify';

// Inside withWriteLock, after the write:
notify(db, { title: 'Note saved', href: '/dashboard/notes' });
```

`href` is optional. Distinct from domain events (in-process side effects): `notify` writes to the DB and shows up in the notification bell.

### Plan Limits (Entitlements)

Enforce per-plan resource caps via `checkEntitlement(plan, limitKey, currentCount)` from `@/lib/entitlements`. Returns `{ allowed, used, limit }`. `-1` = unlimited. Fetch subscription **before** `withWriteLock` (read-only gate), enforce **inside** the lock with a current count. Add new limit keys to `config.ts` under `stripe.limits[plan]`.

### Background Jobs

SQLite-backed queue (`@bitclaw/jobs`) at `data/jobs.db`. Workers start on boot via `server/start.ts` (`startWorkers()`, called there , not via a Nitro plugin, see "Server Boot Side Effects" below). Jobs survive server restarts.

Add a new job type in three steps:
1. Add payload type to `src/features/jobs/types.ts` (`AppJobs` export)
2. Create handler at `src/features/jobs/handlers/my-new-job.ts` , throw on transient failure (worker retries), throw `NonRetryableError` for dead-letter
3. Register worker in `src/features/jobs/workers.ts` via `queue.createWorker({ type, handler, pollIntervalMs, maxRate })`

Enqueue (synchronous, never blocks): `enqueue('my:job', { ...payload })` from `@/features/jobs/enqueue`.

Override queue DB path via `JOBS_DB_PATH` env var (default: `data/jobs.db`).

### Server Boot Side Effects

Startup/shutdown logic (job workers, Sentry init, startup reconciliation) lives in `server/start.ts`, the production entry point , not in a `server/plugins/` Nitro-plugin convention. That convention existed here previously but never actually ran: Nitro's plugin auto-load only fires when Nitro's own Vite plugin is registered with a `scanDirs` pointing at `server/`, which this project's `vite.config.ts` never did. `defineNitroPlugin` was being imported and called but nothing ever executed it, in dev, in `bun run build`, or in the built bundle , see `docs/warpkit/features/jobs.md` for the full incident writeup.

`server/start.ts` is the one file guaranteed to run in production (`bun run start` / `bun cluster.ts`) and never inspected by Vite's client bundler, so it's also where startup reconciliation had to move , the same Vite import-protection false-positive that keeps reconciliation out of `src/start.ts` (see the comment there) blocks it from any file Vite's bundler scans, plugin or not.

**Known limitation**: these side effects only run under `bun run start`, not under `bun run dev`. There is currently no dev-mode equivalent.

Pattern for adding a new startup side effect: add a call (or a fire-and-forget `.then()`/`.catch()` block for anything that shouldn't gate server boot) directly in `server/start.ts`, and a symmetric teardown call in its `shutdown()` function if it needs graceful cleanup on `SIGTERM`/`SIGINT`.

### Prerendering

Adding a prerendered route requires two coordinated changes , missing either causes silent failure:

1. **`vite.config.ts`** , extend filter: `filter: page => page.path === '/' || page.path === '/your-route'`
2. **`server/start.ts`** , add to `PRERENDERED` map: `'/your-route': path.join(distClient, 'your-route.html')`

Only use for static routes with no dynamic segments.

### Query Keys

Define key factories in `src/lib/query-keys.ts` , never inline raw strings in `invalidateQueries`. Import the same factory in both `queryOptions` and `invalidateQueries`.

```ts
// src/lib/query-keys.ts
export const myItemsQueryKey = () => ['my-items'] as const;

// use everywhere , mismatch is a compile-time import error, not a silent runtime bug
await queryClient.invalidateQueries({ queryKey: myItemsQueryKey() });
```

`query-keys.ts` has no server function imports , safe to import in `bun:test`.

**`queryOptions` factories belong in the feature barrel (`index.ts`), not in page components.** Defining them in a page and re-exporting via the barrel creates a circular import (page imports barrel → barrel re-exports page → TypeScript loses all inferred types). Define the factory directly in `index.ts` and import it from there in the page.

### Shared Utilities

`src/lib/utils.ts` exports `cn` (className merge) and `relativeTime(ts: number)` (ms-epoch → "3 minutes ago"). Don't inline relative time math in components.

**Per-user encrypted settings:** `src/lib/db/settings-helpers.server.ts` , typed get/set with optional encryption. See `docs/warpkit/patterns/per-user-settings.md`.

### Routes

TanStack Router: file-based routing. Layout routes: `_app.tsx` (auth shell), `_auth.tsx` (login shell). New page: `src/routes/_app.dashboard.mypage.tsx`. Run `bun run generate` after adding routes.

**Route context is NOT reactive.** `beforeLoad` runs once per mount. Same-parent navigation (`/dashboard/A` → `/dashboard/B`) skips re-run. Route context stays stale after mutations. Fix: use `useQuery(bootstrapQueryOptions)` in layout components instead of reading from route context. Reactivity comes from TanStack Query cache, not TSR context.

**Routes with child routes , always use layout + index.** If a parent route file has no `<Outlet />`, child routes mount silently and render nothing. Silent failure, no error.

Rule: any route file that has sibling files sharing its prefix (`_app.foo.tsx` alongside `_app.foo.bar.tsx`) must be a bare `<Outlet />` layout. Page content always lives in `.index.tsx`.

**URL state requires `validateSearch`** , see `/coding` skill for the pattern. Raw `useSearch()` or `window.location.search` are forbidden; they silently return `unknown`.

**Polling during transient states** , use `router.invalidate()` in a `useEffect` with a `setInterval` to auto-refresh while an entity is in a transient status (`creating`, `bootstrapping`). Refetches both the route loader and all active queries. Stop by making the guard condition false.

**Query-level conditional polling** , use `refetchInterval: query => data?.some(r => r.status === 'running') ? 3000 : false` on `queryOptions` for surgical polling without invalidating unrelated queries.

### Cache Invalidation Layers

When data appears stale after mutation, check 3 layers in order:

1. **React Query cache** , `invalidateQueries` marks stale. `ensureQueryData` returns stale cache immediately. Use `refetchQueries` if you need fresh data before next step (e.g. before navigation).

2. **TanStack Router context** , `beforeLoad` runs once per mount. Same-parent nav skips re-run. Never read reactive data from route context. Use `useQuery()` + TanStack Query cache reactivity.

3. **Server TTLCache** , `invalidateQueries` has no effect on server-side caches. Must call `invalidateBootstrapCache(userId)` (or equivalent) explicitly in the mutation handler.

Example of the full chain:

```ts
// mutation: invalidate all 3 layers
await invalidateBootstrapCache(userId);               // server TTLCache
await queryClient.refetchQueries({                     // React Query (waits for fresh)
  queryKey: bootstrapQueryKey()
});
await router.invalidate();                             // route context (re-run loaders)
```

**Rule of thumb:** Do NOT add `router.invalidate()` to every mutation. Prefer reactive `useQuery()` in layouts. Only add `router.invalidate()` when a loader must re-run after the mutation.

**`invalidateQueries` vs `refetchQueries`:** `invalidateQueries` marks stale + lazy re-fetch on next mount. `refetchQueries` actively re-fetches now. Use `refetchQueries` before navigation where the target page runs `ensureQueryData` in a loader (which returns stale from cache if not refetched).

### Drawers

See `/coding` skill for the full pattern. CRUD drawers: URL-driven (`validateSearch`), `Route.useSearch()` in route file, pass handlers as props to children. Confirmation dialogs: `useState`. Reference: `src/features/feature-requests/components/feature-requests-table.tsx`.

### File Uploads

S3-backed. Activate via env vars (no code change):

```bash
AWS_S3_IAM_ACCESS_KEY=...  AWS_S3_IAM_SECRET_KEY=...
AWS_S3_FILES_BUCKET=my-bucket  AWS_S3_REGION=us-east-1
VITE_S3_FILES_BUCKET=my-bucket   # exposes to client for feature detection
```

`config.uploads.enabled` derived from `VITE_S3_FILES_BUCKET`. Gate ordering: S3 guard before lock, write inside lock. Plan limits: `config.stripe.limits[plan].maxFileUploads` (`-1` = unlimited). User-facing page: `/dashboard/uploads`.

### Feature Flags

Runtime toggles in shared Drizzle DB. Admin page: `/dashboard/admin/feature-flags`.

```ts
import { useFeatureFlag } from '@/hooks/use-feature-flag';
const { enabled } = useFeatureFlag('my_feature');
```

Add default flags in `scripts/seed.ts` under the `FLAGS` array. Run `make db.seed` to apply (idempotent).

### Analytics

Umami and Microsoft Clarity both activate via env vars , no code change, either or both:

```bash
VITE_UMAMI_WEBSITE_ID=your-website-id
VITE_UMAMI_SRC=https://cloud.umami.is/script.js   # optional, defaults to cloud

VITE_CLARITY_PROJECT_ID=your-project-id            # from https://clarity.microsoft.com/
```

Both script tags are loaded by `CookieConsentBanner` (`src/components/cookie-consent/CookieConsentBanner.tsx`), not statically injected in `__root.tsx` , when the `cookie_consent_enabled` flag is on, loading is gated on analytics consent (see Cookie Consent below). When the flag is off, both load unconditionally on mount (explicit admin opt-out of consent gating). Use Umami's UI / Clarity's dashboard for analytics, warpkit's admin for billing/user metrics. Self-hosted Umami: set `VITE_UMAMI_SRC` to your own instance URL.

### Cookie Consent

GDPR banner via `vanilla-cookieconsent`. Controlled by `cookie_consent_enabled` feature flag , toggle in `/dashboard/admin/feature-flags`, no redeploy needed. `<CookieConsentBanner />` is in `__root.tsx`, returns null when flag off. When the flag is on, it also owns loading the Umami and Clarity analytics scripts (see Analytics above): both are only injected via `onConsent`/`onChange` if the `analytics` category is accepted, and rejecting after a prior accept clears `umami.*` and Clarity's (`_clck`, `_clsk`, `CLID`) cookies and reloads the page so neither tracker keeps running. Any future analytics/tracking script must be wired through this same gate, not injected unconditionally elsewhere.

### Credits / Per-call Metering

Per-user credit balance in `users.credits` (shared Drizzle DB). Atomic deduct via `UPDATE WHERE credits > 0 RETURNING` , never goes below zero. `deductCredit(db, userId)` from `@/features/credits/server/credits.server` (NOT re-exported from barrel , import directly). Deduct inside `withWriteLock` alongside the write. Top-up flow: `buyCreditsCheckoutFn` → Stripe `mode: 'payment'` → `handleCreditsPurchase` in `src/features/billing/server/stripe-checkout.server.ts` grants the credits (dedups on the payment intent inside a `db.transaction`, see `docs/warpkit/patterns/webhook-replay.md` , does not call `addCredits()`, which exists only for direct/test-driven credit grants). User-facing page: Settings → Credits.

### Observability (Sentry)

Optional. Set `VITE_SENTRY_DSN` and it activates on both client and server , no code change needed. Client init: `src/lib/sentry.ts` (loaded via `__root.tsx`). Server init: inline in `server/start.ts` (guarded on `VITE_SENTRY_DSN`, runs only under `bun run start` , see "Server Boot Side Effects" above). Don't call `init()` elsewhere. Use `captureException` from `@sentry/tanstackstart-react` (both client and server).

### React Compiler

Active. Do not add `useMemo` or `useCallback` for performance. See `/coding` skill.

## Onboarding Wizard

Wizard state: `useState<1 | 2>(1)`. Add a step: widen the type union, add render case, prefetch data in the route loader. Step components receive `onComplete` (advance) and optionally `onSkip`.

## Adding a New Feature (Step-by-Step)

1. **Schema**: create `src/lib/db/migrations/YYYYMMDD_HHMMSS_description.ts`, add to `USER_MIGRATIONS` in `user-migrations.ts`
2. **Queries**: create `src/features/my-feature/server/my-feature.queries.ts`
3. **Mutations**: create `src/features/my-feature/server/my-feature.mutations.ts`
4. **Rules**: create `src/features/my-feature/server/my-feature.rules.ts` (only if predicates are shared between queries and mutations)
5. **Tests**: create `src/features/my-feature/server/my-feature-crud.test.ts` using `makeTestDb()`
6. **Barrel**: create `src/features/my-feature/index.ts` exporting public API
7. **Route**: create `src/routes/_app.dashboard.my-feature.tsx`, import from barrel only
8. **Run**: `bun run generate` to update route tree, `bun run dev` to test

## Environment Setup

```bash
make init    # First-time: copy env, generate secret, install, migrate, seed
make dev     # Start dev server on port 3000
make db.seed # Re-run seed (idempotent , safe to run again after adding new flags)
```

Required env vars: `DATABASE_PATH`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
See `.env.example` for all options.

### Test environment isolation

The `test` script runs with `--no-env-file --env-file=.env.test`. This means:

- `.env` is **never** loaded during tests , only `.env.test` is.
- Local and CI test runs are identical by construction.
- Any env var a test depends on **must** be in `.env.test`. Never rely on `.env` as a fallback.

If you add a new env var that tests need, add a safe/fake value to `.env.test`. `.env.test` sets a fake `STRIPE_WEBHOOK_SECRET` so signature-validation tests exercise real Stripe signature checking; `handleStripeWebhook` throws a distinct `WebhookConfigError` (not a generic bad-signature `Error`) when the secret is missing, so the one test for that path unsets the var for itself and restores it afterward , see `stripe-webhook.test.ts`.

### CI

`.github/workflows/ci.yml` runs `make ci` (typecheck, build, lint, knip, `bun test`, error-code/barrel/prefetch/webhook-idempotency/client-bundle-leak/boot-smoke/ratelimit-keying checks) on every push/PR , cheap (~1.5 min), zero setup for a fresh fork. This is intentional and unchanged for anyone who forks this template. The boot-smoke check (`check-boot`) is the one check that executes the built app rather than statically analyzing it , see "Server Boot Side Effects" above for why that matters.

e2e tests (`e2e/`, Playwright) ship as source but are **not** part of the default GitHub Actions workflow , most forks won't have `.env.e2e` secrets or want browser binaries slowing down every push. Run them locally with `make e2e` (Chromium only) or `make e2e.all` (all browsers); wire your own workflow if you want them gated in CI.

For repos that want e2e gated without paying for a slow/expensive CI job, `make signoff` wraps `make e2e` with [gh-signoff](https://github.com/basecamp/gh-signoff): run e2e locally, then stamp a commit status via the GitHub API instead of a remote runner. One-time setup: `gh extension install basecamp/gh-signoff`, then `gh signoff install e2e` (repo admin action) to require that status on the default branch , the actual status context is `signoff/e2e` (CLI-prefixed), not bare `e2e`, if you're checking/wiring branch protection by hand. Trust-based, not enforced by a runner , appropriate for a small/trusted-committer repo, not a substitute for `ci.yml`'s automated gate on untrusted PRs. Shows up much more visibly in a PR's checks list than on a commit pushed straight to the default branch (which folds it into one small checkmark alongside `ci.yml`'s check-run).

## Configuration

Everything user-facing lives in `config.ts` at the root:
- `appName`, `domainName`: branding
- `stripe.plans`: pricing tiers (update price IDs from Stripe dashboard)
- `stripe.limits`: per-plan resource caps (`maxNotes`, `maxFileUploads`, `maxApiKeys`; `-1` = unlimited)
- `auth.verificationMethod`: `'otp'` | `'magic-link'` | `'both'`
- `auth.socialProviders`: derived from `VITE_GOOGLE_CLIENT_ID` / `VITE_GITHUB_CLIENT_ID`
- `auth.turnstile`: enable Cloudflare Turnstile captcha
- `uploads.enabled`: derived from `VITE_S3_FILES_BUCKET`; controls Files page visibility
- `credits.enabled`: toggle credits system on/off
- `credits.freeCreditsOnSignup`: credits granted to new users (default: `10`)
- `credits.topUpPriceId`: Stripe one-time price for credit top-ups (`VITE_STRIPE_CREDITS_PRICE_ID`)
- `credits.creditsPerTopUp`: credits added per top-up purchase (default: `100`)
- Analytics (Umami / Clarity): set `VITE_UMAMI_WEBSITE_ID` and/or `VITE_CLARITY_PROJECT_ID` , scripts are loaded by `CookieConsentBanner`, gated on analytics consent when `cookie_consent_enabled` is on (see Analytics section below)
- `VITE_TRIAL_DAYS`: free trial length in days (card required by default; add `VITE_TRIAL_NO_CARD=true` to make card optional); see `docs/warpkit/features/billing.md` for full trial setup

## Commit Workflow

When `/caveman:caveman-commit` is invoked for **code changes**, always run this sequence in full before committing:

```bash
make fix   # auto-fix lint/format
make ci    # typecheck + full test suite
git commit # only if both pass
git push   # always push after commit
```

Skip `make fix` / `make ci` for doc-only changes (`.md`, config, text files) , just commit and push. Never generate a commit message and stop , always execute the full sequence for code.

## Code Review Notes

Patterns that are **intentionally correct** , do not flag as violations:

- **`*.mutations.ts` / `*.queries.ts` importing `*.server.ts` files at the top level** , these are protected by Vite's `**/*.server.*` import rule. The server fn body stripping only removes handler code; the `*.server.*` file itself never reaches the client bundle.
- **`console.error`, `console.warn`, `console.info`** , explicitly allowed. Only `console.log` is banned by Biome.
- **`@/lib/db` imports inside `createServerFn` handler bodies in route files** , all `@/lib/db/**` paths are blocked from client bundles by Vite import protection. Safe when used only inside handler bodies.
- **Top-level `@/lib/db` / `@/server/*` imports in `createServerFn` files (mutations, queries, `src/server/functions/*`)** , safe when the import is referenced ONLY inside handler bodies. Body-stripping removes those references and the now-unused import is dropped before import protection runs; that is why nine files import `db` at top level and every build passes. The leak class is different: a module-scope CALL or non-handler reference keeps the import alive (the onboarding.ts pino incident had `createLogger()` at module scope). Do not flag the import statement itself; flag module-scope usage. Three audit rounds have false-positived on this.

Patterns that CI checks now catch automatically:

- **`err('RAW_STRING', ...)` in any `.ts` / `.tsx` file** , must use `ERROR_CODES.*` constants. Applies to test files too (stub return values count). Caught by `make check-error-codes`.
- **Page component exported from `src/features/*/index.ts`** , routes import page components directly from `features/*/pages/`, never via barrel. Caught by `make check-barrel-pages`.
- **`prefetchQuery({` or `ensureQueryData({` in route files** , bare inline objects store raw `Result<T>` in cache; use a `queryOptions()` factory instead. Caught by `make check-prefetch-bare`.

## Available Skills

Load these in Claude Code sessions for detailed conventions:

| Skill | When to load |
|-------|-------------|
| `/coding` | Before writing any feature code |
| `/testing` | Before writing tests |
| `/architecture` | Architecture questions, adding features |
| `/commands` | Dev workflow reference |
| `/commit-message` | Writing commit messages |
| `/convention-audit` | Full codebase audit against CLAUDE.md + docs conventions |
