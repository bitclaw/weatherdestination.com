# Add a Database Table

Warpkit stores user data in per-user SQLite files. Adding a new table takes two steps: write a migration, then use it in a server function.

## Step 1: Add a migration

Open `src/lib/db/user-migrations.ts` and append a new entry:

```ts
export const USER_MIGRATIONS: UserMigration[] = [
  // ... existing migrations above: never remove or reorder

  {
    id: '001_add_notes',
    run: db => {
      db.run(`
        CREATE TABLE IF NOT EXISTS notes (
          id         TEXT PRIMARY KEY,
          content    TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);
    },
  },
];
```

Rules:
- Never remove or reorder existing entries
- Never change the `id` of an applied migration
- Append only: add new entries at the bottom
- No down migrations: write a new forward migration to undo

The migration runs automatically next time `getUserDb(userId)` is called for any user.

## Step 2: Query the table

```ts
import { getUserDb, withWriteLock } from '@/lib/db/user-db';

// Read
const db = getUserDb(user.id);
const notes = db.query<{ id: string; content: string }, []>(
  'SELECT * FROM notes ORDER BY created_at DESC'
).all();

// Write: always use withWriteLock
return withWriteLock(user.id, () => {
  const db = getUserDb(user.id);
  db.run('INSERT INTO notes (id, content, created_at) VALUES (?, ?, ?)', [
    randomUUIDv7(),
    data.content,
    Date.now(),
  ]);
  return ok({ created: true });
});
```

`withWriteLock` serializes writes per user to prevent `SQLITE_BUSY` errors under concurrent requests.

## Step 3: Test it

```ts
import { makeTestDb } from '@/test/db';

test('creates a note', () => {
  const db = makeTestDb();
  db.run("INSERT INTO notes (id, content, created_at) VALUES ('1', 'hello', 0)");
  const note = db.query("SELECT * FROM notes WHERE id = '1'").get();
  expect(note.content).toBe('hello');
});
```

`makeTestDb()` returns a real in-memory SQLite with all migrations already applied.
