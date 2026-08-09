# Add a Feature

Every feature in Warpkit follows the same structure. Here's how to scaffold one from scratch.

## Feature structure

```
src/features/my-feature/
├── index.ts                          # barrel: public API
├── server/
│   ├── my-feature.queries.ts         # read-only server functions (GET)
│   ├── my-feature.mutations.ts       # write server functions (POST)
│   ├── my-feature.rules.ts           # pure predicates shared between queries/mutations (optional)
│   └── my-feature-crud.test.ts       # integration tests
└── components/                       # optional UI
    ├── MyWidget.tsx
    └── index.ts
```

## Step 1: Schema

Add your table to `src/lib/db/user-migrations.ts` (append only):

```ts
{
  id: '001_add_my_feature',
  run: db => {
    db.run(`
      CREATE TABLE IF NOT EXISTS my_items (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
  },
},
```

## Step 2: Server functions

Create `src/features/my-feature/server/my-feature.queries.ts`:

```ts
import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { ERROR_CODES } from '@/lib/constants';
import { getUserDb } from '@/lib/db/user-db';
import { requireUser } from '@/server/require-user';

export const getItems = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser();
  if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

  const db = getUserDb(user.id);
  const items = db
    .query<{ id: string; title: string }, []>(
      'SELECT * FROM my_items ORDER BY created_at DESC'
    )
    .all();
  return ok(items);
});
```

Create `src/features/my-feature/server/my-feature.mutations.ts`:

```ts
import { randomUUIDv7 } from 'bun';
import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { logUserEvent } from '@/lib/db/user-events';
import { requireUser } from '@/server/require-user';

export const createItem = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ title: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      const id = randomUUIDv7();
      db.run(
        'INSERT INTO my_items (id, title, created_at) VALUES (?, ?, ?)',
        [id, data.title, Date.now()]
      );
      logUserEvent(db, 'item.created', { id });
      return ok({ id, title: data.title });
    });
  });
```

## Step 3: Tests

Create `src/features/my-feature/server/my-feature-crud.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { makeTestDb } from '@/test/db';

describe('my-feature', () => {
  test('inserts and reads items', () => {
    const db = makeTestDb();
    db.run("INSERT INTO my_items (id, title, created_at) VALUES ('1', 'Test', 0)");
    const row = db.query<{ title: string }, []>('SELECT title FROM my_items').get();
    expect(row?.title).toBe('Test');
  });
});
```

Run: `bun test src/features/my-feature`

## Step 4: Barrel

Create `src/features/my-feature/index.ts`:

```ts
export { getItems } from './server/my-feature.queries';
export { createItem } from './server/my-feature.mutations';
```

## Step 5: Route

Create `src/routes/_app.dashboard.my-feature.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { getItems } from '@/features/my-feature';

export const Route = createFileRoute('/_app/dashboard/my-feature')({
  component: MyFeaturePage,
  loader: () => getItems(),
});

function MyFeaturePage() {
  const result = Route.useLoaderData();
  return (
    <ul>
      {result.data?.map(item => <li key={item.id}>{item.title}</li>)}
    </ul>
  );
}
```

## Step 6: Generate route tree

```bash
bun run generate
bun run dev
```

Visit `/dashboard/my-feature`.
