# Per-User SQLite

Every user gets their own SQLite database file at `data/users/<userId>/user.db`.

This is Warpkit's biggest architectural advantage. It means:

- **No shared-table row leaks**: cross-user data access is physically impossible
- **GDPR export is one file copy**: dump a user's entire dataset in one call
- **Account deletion is a folder delete**: no multi-table cascade deletes
- **Zero connection pooling complexity**: each DB is one file, one connection
- **Offline/local-first ready**: SQLite + WAL is the foundation for sync tools like ElectricSQL

## Reading data

```ts
import { getUserDb } from '@/lib/db/user-db';

const db = getUserDb(user.id);
const items = db
  .query<{ id: string; title: string }, []>(
    'SELECT * FROM items ORDER BY created_at DESC'
  )
  .all();
```

`getUserDb` caches connections (up to 200 open at once, LRU eviction). Migrations run automatically on first open.

## Writing data

Always use `withWriteLock` for writes. This serializes concurrent writes per user to prevent `SQLITE_BUSY` errors:

```ts
import { randomUUIDv7 } from 'bun';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';

return withWriteLock(user.id, () => {
  const db = getUserDb(user.id);
  db.run(
    'INSERT INTO items (id, title, created_at) VALUES (?, ?, ?)',
    [randomUUIDv7(), data.title, Date.now()]
  );
  return ok({ created: true });
});
```

## Adding tables

Each migration lives in its own file under `src/lib/db/migrations/`, named with a Laravel-style timestamp prefix (`date +%Y%m%d_%H%M%S`):

```ts
// src/lib/db/migrations/20260608_120000_add_items.ts
import type { Database } from 'bun:sqlite';

export const migration = {
  id: '010_add_items',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS items (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
  }
};
```

Import it in `src/lib/db/user-migrations.ts` and append it to `USER_MIGRATIONS`. Never reorder or remove existing entries, and never change an existing migration's `id` once it's shipped , existing user DBs record applied ids in `_warpkit_migrations` and depend on them staying exact.

## Closing a connection

Connections are managed automatically. If you need to explicitly close a user's DB (e.g., before deleting their files):

```ts
import { closeUserDb } from '@/lib/db/user-db';

closeUserDb(userId);
```

## File location

```
data/
└── users/
    └── <userId>/
        └── user.db
```

Configure `USER_DATA_DIR` in `.env` to change the root path.

## Shared app database

Warpkit also has a shared Drizzle/SQLite database (`data/meta.db`) for global data: users, sessions, subscriptions. This is the `db` import from `@/lib/db`. Per-user databases are separate from this.
