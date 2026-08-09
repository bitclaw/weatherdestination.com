---
name: convention-audit
description: Convention audit of warpkit against CLAUDE.md and docs/ — server functions, feature structure, tests, and documentation coverage
user-invocable: true
---

# warpkit Convention Audit

Do a code review of warpkit against CLAUDE.md conventions and the docs/ folder.

Before writing findings, read `.claude/skills/coding/SKILL.md` and
`.claude/skills/testing/SKILL.md` , both have a documented exceptions list (single-row
PK write, injectable interfaces, self-contained `setupServer()`) that must be applied
BEFORE flagging, not after. Ported from a cross-repo audit of sibling repo
runmist-warpkit (2026-07-02) where several false positives required a manual
re-verification pass to retract because these exceptions weren't folded into the
audit prompt itself.

This is a single-tenant template (per-user SQLite, no workspace/multi-tenant concept).
Don't expect `requireWorkspaceMembership` or `withWorkspaceLock` , those are
runmist-warpkit-specific additions from its fork. This repo has `requireUser()`,
`requireAdmin()`, and `withWriteLock(user.id, fn)` instead.

## Convention audit (src/ only, skip node_modules/)

Check every .ts and .tsx file for:

### Server functions
- Every authenticated mutation calls `requireUser()` (returns `session.user` or `null`;
  check `if (!user) return err(ERROR_CODES.UNAUTHORIZED, ...)`) or `requireAdmin()`
  (returns a Result; check `if (!adminResult.ok) return adminResult`) as appropriate
- Every POST server function has `.inputValidator(z.object(...))`
- All per-user DB writes (via `getUserDb(user.id)`) wrapped in `withWriteLock(user.id, fn)`
  , EXCEPT single-row UPDATE-by-PK writes that are idempotent, don't depend on current DB
  state (no check-then-write), and don't call `logUserEvent`. Check this exception before
  flagging any write outside the lock (see CLAUDE.md's "Exception: single-row UPDATE by PK").
- Read-only gates are BEFORE `withWriteLock`
- Mutable state gates (status, uniqueness) are INSIDE `withWriteLock` with a fresh DB read
- No server function throws, returns `ok(...)` / `err(ERROR_CODES.*, ...)` only , includes
  throws used as normal control flow inside a `withWriteLock` callback, not just at the top level
- No raw error string in `err()`: must use `ERROR_CODES.*` constants from
  `src/lib/constants/errors.ts`. Check MULTI-LINE calls too (code string on the line after
  the opening paren, e.g. `err(\n  'RAW_CODE',\n  ...)`) , these are easy to miss when
  skimming and slipped past a same-line-only grep in a prior audit. Grep with:
  `grep -rlPzo --include="*.ts" --include="*.tsx" "err\(\s*['\"][A-Z_]+['\"]" src/`
  ALSO check for a subtler indirection: a local `const X = 'RAW_STRING'` (or a type field
  typed as a raw string-literal union) declared in a `*-logic.ts`/`*.server.ts` file, then
  passed into `err(X, ...)` from a different file , this bypasses any literal-at-callsite
  grep entirely. Read files that declare local UPPER_SNAKE_CASE consts near the top and
  check if they duplicate an existing `ERROR_CODES.*` value.
- `randomUUIDv7` from `'bun'` used server-side (not `crypto.randomUUID()`)
- Top-level imports of Node/Bun-only modules inside `createServerFn` files use dynamic
  `import()` inside the handler body, not top-level (prevents client bundle leaks). This
  includes TRANSITIVE leaks: if a statically-imported package (check its actual installed
  code in node_modules) itself has a top-level `node:`-builtin import, that counts too ,
  don't just check the import statement in the repo's own file, trace one level into
  node_modules for anything imported from a `*.mutations.ts`/`*.queries.ts` file's top level.
- Non-`.server.ts`-named helper files (`*-logic.ts`, `*-helpers.ts`) that are statically
  imported by a `.mutations.ts`/`.queries.ts` file must NOT have a top-level `node:`-builtin
  or Node-only third-party import , if they do, rename to `*.server.ts` (covered by Vite's
  import-protection glob) or use a dynamic import.
- If a callback returns both `ok(...)` and a raw (non-Result) value on different branches,
  that's a bug , the caller unwrapping/re-wrapping it will double-wrap or lose the err

### Feature structure
- Every feature has `index.ts` barrel exporting public API
- Page components NOT exported from barrel (routes import from `features/*/pages/` directly)
- `queryOptions` factories defined in barrel (`index.ts`), not in page components
- `prefetchQuery` / `ensureQueryData` always use a `queryOptions()` factory, never bare
  inline object. This is the single biggest bug class found in the sibling repo's audit: a
  bare inline `queryOptions({...})` object stores the raw `Result<T>` in the shared
  TanStack Query cache instead of unwrapped data, causing `.map` crashes downstream. Check
  every route file's loader carefully, and check whether the corresponding page
  component's own `useQuery()` calls use the SAME factory (not a second inline duplicate
  with a different shape) , a route using a factory but the page using its own inline
  object for the same queryKey is just as broken as neither using one.
- Query key factories defined in `src/lib/query-keys.ts`, same factory used in both
  `queryOptions` and `invalidateQueries`

### Import rules
- No `src/lib/db/**` or `src/db/**` imports in route or component files
- No `*.server.*` imports in client-visible files (components, hooks, routes)
- `@/` alias used everywhere, never relative `../../` when an alias equivalent exists

### TypeScript style
- `type` not `interface`
- `import type` for type-only imports
- Arrow functions for helpers
- No `useMemo`/`useCallback` for performance (React Compiler active)
- No `console.log` (Biome bans it); use `console.error`/`warn`/`info`

## Test audit (src/**/*.test.ts)

Check for:
- No mocks of the database, real SQLite via `makeTestDb()`/`makeTestSharedDb()` only ,
  EXCEPT a hand-rolled fake satisfying a type named `*Like` (e.g. `JobQueueLike`) or
  commented "INJECTABLE INTERFACE" when the real dependency is itself an already-tested
  external package (`@bitclaw/jobs`). That's sanctioned DI, not a DB mock , only flag
  mocks of `bun:sqlite`/Drizzle objects directly.
- `mswServer.use()` only for URLs with default handlers (Stripe, Resend, Turnstile) —
  arbitrary URLs use `Bun.serve()` per test. A test file's own private `setupServer()`
  instance is NOT a safe alternative here (retracted 2026-07-05, see testing SKILL.md) ,
  `src/test/setup.ts` calls `mswServer.listen()` globally for every test run, so a second
  `setupServer()` instance's `listen()`/`close()` lifecycle stomps on the same process-wide
  `node:http` interceptor patch and can silently break Stripe/Resend mocking in *other*
  test files running in the same bun:test process. Flag a private `setupServer()` as a
  violation; the fix is a new default handler in `src/test/msw/handlers.ts`, not isolation
  via a second server instance.
- Tests assert behaviour and outcomes, not implementation details (no spying on private
  methods). Watch specifically for a test that re-implements a server function's DB write
  inline (duplicating the logic instead of exercising it) , the test suite would keep
  passing even if the real handler's logic regressed. If a test file's own comment claims
  to "mirror" a handler's logic rather than call it, that's a strong signal of this bug.
- Each test has a clear Given/When/Then shape (setup, action, assertion)
- No test depends on ordering or shared mutable state between tests
- `requireAdmin`/`requireUser` have their OWN dedicated test file
  (`src/server/require-gates.test.ts`) , do NOT flag individual features for not calling
  the real `createServerFn` wrapper in their own tests, per the testing skill's "What NOT
  to Test: server functions directly" rule. The shared auth gates are the one exception:
  they're the primitive every feature trusts and none of them re-verify, so they get
  tested once, directly, here , not N times over per feature.
- Error paths tested: unauthorized, not found, validation failure , for the shared auth
  gates and for security/billing/admin-critical mutations specifically
- No raw SQL assertions that duplicate schema knowledge unnecessarily

## Documentation audit (docs/)

For each feature that exists in `src/features/`:
- Is there a corresponding doc in `docs/warpkit/features/` or inline in CLAUDE.md?
- Does the doc explain the WHY (not just the what)?
- Are patterns documented once (not duplicated across files)?
- Are there patterns used in 3+ places that are not yet documented?
- Security-sensitive features (impersonation, admin role checks, disposable-email
  gating) get extra scrutiny , flag missing docs on these as higher priority than a
  cosmetic feature's missing doc.

## Reporting

Report findings as:
- `path:line: VIOLATION: <rule violated>. Fix: <what to change>.`
- `path: MISSING DOC: <what is undocumented>.`
- `path:line: GOOD: <only for genuinely non-obvious correct patterns, to prevent future over-flagging>.`

Skip: formatting nits, naming style (already enforced by Biome), anything already caught by `make ci`.
Focus on logic correctness, security, and architectural invariants.

Before reporting a finding, spot-check it against CLAUDE.md and the two skill files above ,
if a memory/instinct says "this looks wrong" but the exceptions list might apply, read the
actual implementation before flagging. A finding that requires no verification to report is
more likely to be a mechanical false positive than a real bug.

## Recommended execution

Delegate this to 4 parallel subagents (Agent tool, background), one each for: server
functions, feature structure/imports, tests, documentation. Each agent prompt should embed
the relevant section above verbatim plus the exceptions list, since a fresh subagent has no
context from this skill invocation. Compile and spot-verify the combined findings before
reporting to the user , see "Reporting" above.
