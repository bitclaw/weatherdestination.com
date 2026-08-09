# Feature Skeleton

Copy this directory into `src/features/<your-feature>/` and replace `FEATURE` / `Entity` / `entity` throughout.

```
cp -r scripts/skel/feature src/features/my-feature
```

Then:
1. Replace `FEATURE` with your feature name (e.g. `widgets`)
2. Replace `Entity` with your record name (e.g. `Widget`)
3. Replace `entity` with the lowercase singular (e.g. `widget`)
4. Add your DB columns to `*.constants.ts` and `*.server.ts`
5. Add your zod fields to `*.mutations.ts`
6. Wire the route in `src/routes/_app.FEATURE.tsx`
7. Add nav item in `src/components/layout/AppLayout.tsx`

## File roles

| File | Purpose |
|------|---------|
| `FEATURE.constants.ts` | Types + `as const` arrays safe for client import. Never `*.server.*` |
| `server/FEATURE.server.ts` | DB layer , Row type, Record type, CRUD fns, `toView()` |
| `server/FEATURE.queries.ts` | Read server fns , thin wrappers over server.ts |
| `server/FEATURE.mutations.ts` | Write server fns , `.inputValidator()` + `withWriteLock` |
| `server/FEATURE-crud.test.ts` | bun:test unit tests against `makeTestDb()` (in-memory, default) |
| `server/FEATURE-logic.test.ts` | bun:test unit tests against `getUserDb()` + `USER_DATA_DIR` (file-based; use when porting from mock-heavy tests) |
| `pages/index.tsx` | Page component + canonical `queryOptions` export |
| `pages/detail.tsx` | Detail page + factory `queryOptions` (scoped by id) |
| `_app.FEATURE.tsx` | List route with loader prefetch |
| `_app.FEATURE.$entityId.tsx` | Detail route , `useParams()` wrapper around detail page |
| `pages.ts` | Re-export barrel for page + queryOptions |
| `index.ts` | Public feature barrel |

## Testing

Two patterns. Choose based on what the test needs.

### `makeTestDb()` , in-memory SQLite (default)

```typescript
import { makeTestDb } from '@/test/db';
import { createEntity } from './FEATURE.server';

it('creates entity', () => {
  const db = makeTestDb(); // in-memory, migrations applied, no cleanup
  const result = createEntity(db, { title: 'Hello' });
  expect(result.ok).toBe(true);
});
```

Fast, no env var management, no file cleanup. Use this for most CRUD logic.

### `getUserDb()` + `USER_DATA_DIR` , file-based SQLite

```typescript
import { closeUserDb, getUserDb } from '@/lib/db/user-db';

let testDir: string;
let originalUserDataDir: string | undefined;
let userId: string;
let db: Database;

beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warpkit-FEATURE-test-'));
  originalUserDataDir = process.env.USER_DATA_DIR;
  process.env.USER_DATA_DIR = testDir;
  userId = randomUUIDv7();
  db = getUserDb(userId);
});

afterAll(() => {
  closeUserDb(userId);
  if (originalUserDataDir !== undefined) {
    process.env.USER_DATA_DIR = originalUserDataDir;
  } else {
    delete process.env.USER_DATA_DIR;
  }
  fs.rmSync(testDir, { recursive: true, force: true });
});

beforeEach(() => {
  db.run('DELETE FROM entities');
});
```

Use when:
- **Porting from a mock-heavy codebase.** If the source tests mock `@tanstack/react-start`, auth, or the DB layer , extract DB logic into `FEATURE.server.ts` and test it directly with this pattern. Zero mocks needed.
- **Logic calls `getUserDb()` internally** (job handlers, utilities that take `userId` not `db`). `makeTestDb()` can't substitute there.
- **Real file-based SQLite behaviour matters** (WAL mode, concurrent writes).

See `server/FEATURE-logic.test.ts.skel` for the full template.

## Complex entity variant (detail + settings)

Use this when an entity has both a **detail/overview view** (related data, status timeline, logs) AND **editable configuration** that warrants its own page.

Route shape:
```
/FEATURE                        → list (thin, navigate-to-edit)
/FEATURE/new                    → create form
/FEATURE/$entityId              → detail/overview page (deployments, logs, related data)
/FEATURE/$entityId/settings     → settings/edit form
```

File additions over the standard skel:
- `pages/settings.tsx` , settings form (same FormShell pattern, breadcrumb links back to detail)
- `_app.FEATURE.$entityId.settings.tsx` , settings route with loader prefetch

List page edit link points to `/$entityId/settings`, not `/$entityId`:
```tsx
<Link to="/FEATURE/$entityId/settings" params={{ entityId: entity.id }}>
  <Pencil className="h-4 w-4" />
</Link>
```

When to use:
- Entity has related child data worth a dedicated view (deployments, logs, metrics)
- Settings have multiple logical sections (General, Build, Environment, Infrastructure)
- Simple edit form at `/$entityId` would crowd out the overview data

Simple CRUD entities (ssh keys, git accounts, cloud accounts) stay on the standard flat pattern.

## Stateful entity variant

For entities with a lifecycle (jobs, deployments, builds, orders):

- Replace `server/FEATURE.server.ts` with `server/FEATURE-stateful.server.ts`
- Replace `server/FEATURE.mutations.ts` with `server/FEATURE-stateful.mutations.ts`
- Adjust `VALID_TRANSITIONS` and add/remove transition fns to match your domain statuses
- Error mapping: `EntityNotFoundError` → `ERROR_CODES.NOT_FOUND`, `InvalidEntityTransitionError` → `ERROR_CODES.CONFLICT`

## Shared form layout (FormShell pattern)

Create and Edit forms share layout (breadcrumb, error banner, `<form>` element) via a `FormShell` component that accepts `children` and an `onSubmit` callback. Each form keeps its own `useForm` hook and renders its own `form.Field` calls inside the shell.

```tsx
// ✅ correct , each form owns its hook; shell owns layout only
function FormShell({ children, onSubmit, title, actionError, backTo }) { ... }

function EditForm({ entityId }) {
  const form = useForm({ ... });
  return (
    <FormShell onSubmit={() => form.handleSubmit()} title="Edit" backTo="/FEATURE" actionError={...}>
      <form.Field name="title">{field => <input ... />}</form.Field>
    </FormShell>
  );
}

// ❌ wrong , TanStack Form generics are too complex to express as a prop type
function SharedForm({ form }: { form: ReturnType<typeof useForm<T>> }) { ... }
// AnyFormApi also loses type safety on field names
```

See `pages/detail.tsx` for the full implementation.

## Form field validators (Zod + Standard Schema)

Zod 3.24+ implements Standard Schema , TanStack Form 1.x accepts Zod schemas directly in `validators.onChange`, no adapter needed:

```tsx
// ✅ direct Zod schema , no callback, no safeParse
<form.Field name="title" validators={{ onChange: z.string().min(1).max(200) }}>

// ❌ old pattern , verbose and redundant
validators={{
  onChange: ({ value }) => {
    const result = z.string().min(1).safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  }
}}
```

**Shared schema (Theme 8):** Define `entityInputSchema` in `FEATURE.constants.ts` and import it in both `FEATURE.mutations.ts` (`.inputValidator()`) and the form. Use `schema.shape.fieldName` for required fields:

```tsx
validators={{ onChange: entityInputSchema.shape.title }}  // ✅ stays in sync with server schema
```

**Optional-field gotcha:** `schema.shape.field` only works when the field is **required** in the Zod schema. Optional fields (`z.string().optional()`) have input type `string | undefined`, but a TanStack Form field value is always `string` (set by `defaultValues`). TypeScript rejects the mismatch at compile time.

```tsx
// ❌ fails , ZodOptional<ZodString> input is string | undefined, not string
validators={{ onChange: projectInputSchema.shape.gitRepoUrl }}  // gitRepoUrl is .optional()

// ✅ inline the non-optional constraint instead
validators={{ onChange: z.string().refine(v => !v.trim() || /pattern/.test(v), 'message') }}
// or for simple length constraints:
validators={{ onChange: z.string().min(1).max(120) }}
```

## Encrypted per-user settings (`app_settings`)

For features that need to store API tokens, webhook secrets, or other sensitive per-user config, use the `settings-helpers.ts` layer over the existing `app_settings` table (already in migration 002 , no schema work needed).

```ts
import { deleteSetting, getSettingValue, upsertSetting } from '@/lib/db/settings-helpers';

// Read (auto-decrypts enc:v1: prefix if present)
const token = getSettingValue(db, 'provider.cloudflare.apitoken');

// Write plain value
upsertSetting(db, 'provider.cloudflare.zoneid', zoneId, false);

// Write encrypted value (AES-256-GCM, stored as enc:v1:… prefix)
upsertSetting(db, 'provider.cloudflare.apitoken', apiToken, true);

// Delete
deleteSetting(db, 'provider.cloudflare.apitoken');
```

**Key naming convention:** `feature.{entityId}.fieldName` , dot-separated, feature-namespaced, entity-scoped. Examples: `mailpit.srv_abc.password`, `provider.cloudflare.apitoken`.

**Encryption detection:** `getSettingValue` auto-decrypts if the stored value starts with `enc:v1:`. No separate `encrypted` column needed , the prefix is the flag. The admin settings UI uses the same prefix to display `••••••••` for masked values.

**When to use:** Prefer `app_settings` for small per-user config values (tokens, flags, URLs). Don't use it for large structured data , put that in a dedicated table.

## Admin multi-page layout

For admin sections with multiple sub-pages (users, feature-flags, settings, database, etc.), use a layout route + index route pattern:

```
src/routes/
  _app.admin.tsx          ← layout: auth check in beforeLoad, Outlet + sub-nav sidebar
  _app.admin.index.tsx    ← default content (e.g. users list)
  _app.admin.feature-flags.tsx
  _app.admin.settings.tsx
```

Key rules:
- **Auth check in `beforeLoad`** on the layout , nested routes inherit automatically. No per-route duplication.
- **Sub-nav active state:** use `exact: true` for the index link (`pathname === href`), `exact: false` for feature links (`pathname.startsWith(href)`).
- **No loader needed** on feature routes that fetch on mount , only add `loader` + prefetch when data must be ready before render.
- Each new admin sub-page = one new route file. Layout never changes.

## Important: Link params

Always use `to` + `params` for parameterized routes , never template literals:

```tsx
// ✅ correct , route types from generated registry enforce this
<Link to="/feature/$entityId" params={{ entityId: entity.id }}>View</Link>

// ❌ wrong , passes local tsc, fails CI (route types generated during build)
<Link to={`/feature/${entity.id}`}>View</Link>
```

Local `tsc --noEmit` does NOT catch this. Always run `make ci` before pushing.
