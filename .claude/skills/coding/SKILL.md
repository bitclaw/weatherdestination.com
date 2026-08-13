---
name: coding
description: MANDATORY coding rules and patterns for warpkit. Load this BEFORE writing any code: features, fixes, refactors, anything.
user-invocable: true
---

# warpkit Coding Standards

## NON-NEGOTIABLE RULES

These rules apply to every line of code you write. No exceptions. Violations are bugs.

### Server Functions

Every server-side operation uses `createServerFn` from `@tanstack/react-start`.

| Rule | Wrong | Right |
|------|-------|-------|
| Always authenticate | No auth check | `const user = await requireUser(); if (!user) return err(...)` |
| Always validate POST input | Raw `request.json()` | `.validator(z.object({ ... }))` |
| Always return result types | `throw new Error(...)` | `return ok(data)` / `return err('CODE', 'message')` |
| Serialize writes | Direct DB write | `return withWriteLock(user.id, () => { ... })` |
| Never import DB in routes | `import { db } from '@/db'` in route file | Call server function, or import crud from feature |

Canonical pattern:
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
  .validator(z.object({ title: z.string().min(1).max(200) }))
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

### Database Access

| Rule | Wrong | Right |
|------|-------|-------|
| Per-user DB only | Shared `db` instance | `getUserDb(user.id)` |
| Serialize writes | Concurrent writes | `withWriteLock(user.id, fn)` |
| Never import user-db in client code | `import { getUserDb } from '@/db/user-db'` in component | Server function only |

**Exception , single-row UPDATE by PK**: `withWriteLock` may be omitted only when ALL of: single row by primary key, idempotent, doesn't depend on current DB state (no check-then-write), no `logUserEvent` call. See CLAUDE.md for the full rule and worked example. Don't flag a "verify external state, stamp a status column" call without checking this first , a 2026-07-02 cross-repo audit produced false-positive lock-race findings on exactly this pattern.

### Feature Structure

Every feature lives in `src/features/<name>/` with this shape:
```
src/features/<name>/
├── index.ts                      # barrel: public API of this feature
├── components/                   # optional: feature-specific UI components
└── server/
    ├── <name>.queries.ts         # read-only server functions (GET)
    ├── <name>.mutations.ts       # write server functions (POST)
    ├── <name>.rules.ts           # optional: pure predicates shared between queries/mutations
    └── <name>-crud.test.ts       # integration tests (real SQLite)
```

`index.ts` exports only what routes need. Nothing else leaks out.
**queries.ts** , `createServerFn({ method: 'GET' })` only. No writes.
**mutations.ts** , `createServerFn({ method: 'POST' })` only. All writes through `withWriteLock`.
**rules.ts** , pure functions, no I/O. Only create if predicates are shared between queries and mutations; inline otherwise.

### TypeScript

| Rule | Wrong | Right |
|------|-------|-------|
| `type` over `interface` | `interface Foo {}` | `type Foo = {}` |
| Type imports | `import { MyType }` | `import type { MyType }` |
| Arrow functions | `function helper() {}` | `const helper = () => {}` |
| Components PascalCase | `myComponent` | `MyComponent` |
| Functions camelCase | `MyFunction` | `myFunction` |
| Directories kebab-case | `MyFeature/` | `my-feature/` |
| Nested ternaries | `a ? b : c ? d : e` | `if`/`else`, or a mapping object for 3+ cases |

### Imports

- `@/` alias for `src/`: always use it, never relative `../../`
- Import from feature's `index.ts` barrel, not deep into internals
- Biome enforces `useImportType` and `useExportType`: follow them

### No Abstractions for Single Use

Before extracting a helper, ask: is it used more than once? Does it add meaningful logic? If no to either, inline it.

### Refactoring Discipline

Before changing working code that isn't the thing you were asked to fix, verify all three:
1. The original has a **real bug or safety issue** , not just "looks wrong" or "could be cleaner"
2. The replacement is **provably safer** , not just syntactically different
3. The fix doesn't introduce **new problems** , silent defaults, weaker types, fabricated context

If not all three, leave it alone. A cast that's now redundant isn't wrong; a pattern that matches a documented convention isn't a bug just because a different approach also exists. "Matches existing convention" is a fine answer when the convention itself is sound , it's not a fine answer when the convention itself is the thing being questioned. Check which one you're in before answering.

### UI Components — Search Before Create

Before writing any new component in `src/components/ui/` or a feature's `components/`, search first:
1. `grep` the name/purpose against `src/components/ui/index.ts` (shared kit barrel) and any feature `components/` dirs.
2. If something close exists (same shape, similar props, same visual role), reuse or extend it , do not create a parallel version.
3. Only add a new component when nothing in the barrel or feature dirs covers the need. State briefly why existing components don't fit before creating one.

This applies with the same force as the barrel-import rule above , duplicated components are drift that compounds silently.

### Error Handling

Server functions return `ok(data)` or `err(ERROR_CODES.CODE, 'Human message')` from `@bitclaw/result`. Never throw from a server function: callers check `.ok` / `.data` or `.ok` / `.code` + `.message` on the result. Error codes live in `src/lib/constants/errors.ts` , always use `ERROR_CODES.*` constants, never raw strings.

**Calling a server function from a component**, the shape below is the standard , `try/catch` for network/thrown errors, an explicit `if (!result.ok)` check for business errors (a rejected `Result` is not a thrown exception, `.catch()`/`onError` never sees it):

```ts
const handleBuyOnce = async (priceId: string) => {
  setError(null);
  setLoading(priceId);
  try {
    const result = await createOneTimeCheckoutFn({ data: { priceId } });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    window.location.href = result.data.url;
  } catch (caught: unknown) {
    setError(caught instanceof Error ? caught.message : 'Failed to open checkout');
  } finally {
    setLoading(null);
  }
};
```

Reference: `src/features/billing/pages/index.tsx`'s `handleBuyOnce`/`handleUpgrade`/`handleManage`.

### UUID Generation

- Server-side (server functions, mutations): `randomUUIDv7()` from `bun` , time-sortable, better DB index performance
- Client-side (React components, browser context): `crypto.randomUUID()` , Web Crypto API, Bun not available in browser

Both produce standard UUID strings; they're fully compatible as DB primary keys.

**Exception , better-auth-owned tables**: `users`, `sessions`, `accounts`, and
`verifications` are NOT app-generated , better-auth creates their IDs itself via its
own `generateId()`, which by default produces a 32-char alphanumeric string
(`createRandomStringGenerator('a-z', 'A-Z', '0-9')`), not an RFC4122 UUID, unless
`auth.ts`'s `advanced.database.generateId` is explicitly set to `'uuid'` (it isn't,
here). Don't validate a `userId`/`sessionId` input with `z.string().uuid()` , it will
reject every real ID. Use a shape-matching regex instead (see `userIdSchema` in
`src/features/admin/server/admin.mutations.ts` for the pattern). This bit a 2026-07-02
audit: a test's own suggested "fix" (tightening to `.uuid()`) would have broken every
legitimate admin action on real users had it shipped without checking the actual ID
generator first.

### Console

Biome bans `console.log`. Use `console.error`, `console.warn`, or `console.info` only.

### useMemo / useCallback

React Compiler is active. Do NOT add `useMemo` or `useCallback` for performance. They are only valid for:
- `useCallback` where the function is a `useEffect` dependency (Biome enforces this)
- `useMemo` for impure computations frozen at mount (e.g., `Math.random()` seeds)

Everything else is redundant.

### TanStack Query: Route Data Loading

Every data-dependent route follows the `queryOptions` factory + `ensureQueryData` (loader) + `useSuspenseQuery` (component) pattern , never a bare `useQuery` for primary route data.

| Step | Where | What |
|------|-------|------|
| 1. Define queryOptions | Feature barrel (`index.ts`) or `src/server/functions/` | Factory with `queryKey` + `queryFn` + `staleTime` |
| 2. Load in `beforeLoad`/`loader` | Route file | `await context.queryClient.ensureQueryData(myQueryOptions)` |
| 3. Read in component | Component body | `useSuspenseQuery(myQueryOptions)` , data guaranteed, never `undefined` |

```ts
// src/server/functions/bootstrap.ts
export const bootstrapQueryOptions = queryOptions({
  queryKey: bootstrapQueryKey(),
  queryFn: () => getBootstrapDataFn(),
  staleTime: Number.POSITIVE_INFINITY
});

// src/routes/_app.tsx , beforeLoad
const result = await context.queryClient.ensureQueryData(bootstrapQueryOptions);

// component , data always defined, no loading guard needed
const { data } = useSuspenseQuery(bootstrapQueryOptions);
```

`useQuery` (not suspense) is fine for secondary, non-route-blocking data. See CLAUDE.md's "Query Keys" section for key-factory naming and placement , this section is about the load/read contract, that one's about the key itself.

### Avoid useEffect

[You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) , prefer TanStack Router loaders, `useQuery`/`useSuspenseQuery`, event handlers, or derived state.

| Scenario | Wrong | Right |
|----------|-------|-------|
| Data fetching | `useEffect(() => fetch(...), [id])` | TanStack Router loader or `useSuspenseQuery` |
| Derived state | `useEffect(() => setFull(first + last), [first, last])` | `const full = first + last` |
| Responding to events | `useEffect(() => { if (submitted) save() }, [submitted])` | Call `save()` in the event handler |
| Resetting state on prop change | `useEffect(() => setVal(prop), [prop])` | `key={prop}` on the component |

**`useEffect` IS appropriate for**: event listeners with cleanup (`AbortController`), timers, external subscriptions, DOM measurements via refs. The polling pattern in `src/features/billing/hooks/use-billing-poll.ts` (`useEffect` + `setInterval` + `router.invalidate()` to auto-refresh during a transient state) is exactly this , a legitimate external-timer use, not a violation of this rule.

### React: State

| Rule | Wrong | Right |
|------|-------|-------|
| Descriptive state names | `const [state, setState] = useState(...)` | `const [attempts, setAttempts] = useState(...)` |
| No side effects in setters | `setState(prev => { save(prev); return next })` | `setState(next)` + `useEffect` to sync |
| Derived state over redundant state | Two counters tracking related things | One counter, derive the other |

State setter callbacks must be pure. To persist to storage, sync a ref, or call an API when state changes, use a `useEffect` that watches the state , don't do it inside the setter itself.

### React: Navigation

| Rule | Wrong | Right |
|------|-------|-------|
| Leaving a completed step | `router.navigate({ to: '/next' })` | `router.navigate({ to: '/next', replace: true })` |

When navigating away from a step the user intentionally completed (onboarding, checkout, multi-step forms), use `replace: true` so browser-back can't re-enter the completed step. Reference: `src/routes/onboarding.tsx`'s `handleComplete`.

### Forms (TanStack Form)

Field-level Zod validators, not a form-level adapter:

```ts
const form = useForm({
  defaultValues: { name: user.name ?? '' },
  onSubmit: ({ value }) => { /* ... */ }
});

<form.Field name="name" validators={{ onChange: z.string().max(100) }}>
  {field => (
    <FormField
      error={field.state.meta.errors[0]?.toString()}
      htmlFor="name"
      label="Display name"
    >
      <input
        id="name"
        onBlur={field.handleBlur}
        onChange={e => field.handleChange(e.target.value)}
        value={field.state.value}
      />
    </FormField>
  )}
</form.Field>
```

Reference: `src/routes/onboarding.tsx`.

### Components

**9-step ordering , every component, every time:**

1. Module-level constants
2. External/fetched data functions (`queryOptions` factories)
3. Type definitions
4. Component function signature
5. Hooks (`useState`, `useSuspenseQuery`, etc.)
6. Local variables / derived state
7. Internal handler functions
8. Effects (`useEffect`)
9. JSX return

### Styling (Tailwind)

| Rule | Wrong | Right |
|------|-------|-------|
| Status colors | `text-green-500`, `bg-red-50` | Design tokens: `text-destructive`, `bg-muted`, `text-primary-foreground` |
| Error/status banners | Inline `border-red-200 bg-red-50` div | `<StatusBanner>`/`<ErrorBanner>` component |
| Color without dark-mode support | `bg-white text-black` | `bg-background text-foreground` |

Reach for a design token (`bg-primary`, `text-muted-foreground`, etc.) before a raw Tailwind color , tokens carry dark-mode support and stay consistent with the rest of the app; raw colors silently break in dark mode and drift from the palette.

### URL State (validateSearch)

Any route that reads or writes search params must declare `validateSearch` in the route definition. Raw `useSearch()` without a `from` or `Route.useSearch()` returns `unknown`.

```ts
export const Route = createFileRoute('/_app/dashboard/my-route/')({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab as string | undefined) ?? 'general'
  }),
  component: MyPage
});

// In the component (not in child components):
const { tab } = Route.useSearch();
```

TSR requires all keys declared in `validateSearch` to be present when navigating. Pass `undefined` to clear optional params.

### Drawers

Two patterns depending on intent:

**CRUD drawers** (create/edit): URL-driven state in `validateSearch`. Use `Route.useSearch()` and `useNavigate({ from: Route.fullPath })` in the route component. Pass open/close handlers as props to child components. Never call `useSearch({ from: '...' })` in child components (TSR path ambiguity).

**Confirmation dialogs** (delete, destructive): component state (`useState`). Transient, no URL identity.

Reference: `src/features/feature-requests/components/feature-requests-table.tsx`.

---

## Checklist Before Submitting Code

- [ ] Every server function calls `requireUser()` first
- [ ] Every POST server function has `.validator(z.object(...))`
- [ ] All DB reads use `getUserDb(user.id)`
- [ ] All DB writes wrapped in `withWriteLock(user.id, fn)`
- [ ] Server functions return `ok(...)` / `err(...)`, never throw
- [ ] Feature has `index.ts` barrel exporting its public API
- [ ] No `@/db/user-db` imports in route or component files
- [ ] `type` not `interface`, `import type` for type-only imports
- [ ] No `console.log`: use `console.error/warn/info`
- [ ] New UI component: checked `src/components/ui/index.ts` + feature `components/` dirs first, nothing existing fit
- [ ] `make ci` passes (typecheck + lint + test + build)
