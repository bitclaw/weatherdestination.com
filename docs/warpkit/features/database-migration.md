# Database Migration

Warpkit defaults to per-user SQLite. This page covers why UUIDv7 was chosen for IDs, and what a migration to Turso, PostgreSQL, or MySQL looks like if you outgrow local SQLite.

## Why UUIDv7

Warpkit uses `Bun.randomUUIDv7()` instead of `crypto.randomUUID()` (UUIDv4). The format is identical: a standard UUID string: but v7 is time-ordered and monotonically increasing within the same millisecond.

```ts
import { randomUUIDv7 } from 'bun';

const id = randomUUIDv7();
// e.g. "019e3bbe-3150-7001-a28b-5fcf6ba4d1ad"
//      ^^^^^^^^^^^^ timestamp prefix: sequential
```

No package required. Bun ships it natively.

### Why it matters across database targets

| Database | UUIDv4 | UUIDv7 |
|----------|--------|--------|
| **SQLite / Turso** | Fine: stored as TEXT, no clustered index | Slightly better B-tree locality on insert |
| **PostgreSQL / Supabase** | Works: native `uuid` type, heap storage | Better index locality on high-insert tables |
| **MySQL / PlanetScale** | Index fragmentation: InnoDB clustered PK = random page splits | Sequential → no fragmentation |
| **SingleStore** | Works | Better columnstore temporal alignment |

UUIDv7 wins on every target. No tradeoffs: format is identical, tooling handles both transparently.

---

## Migration to Turso

**Effort: Low.** Turso runs libSQL, a SQLite fork. Queries are identical. Only the client instantiation changes.

### Why Turso

- Managed SQLite hosting: no disk volume to maintain
- Embedded replicas: local SQLite file that syncs to cloud (zero-latency reads, cloud durability)
- Per-database model maps exactly to Warpkit's per-user model
- Free tier: 500 databases

### Step 1: Install client

```bash
bun add @libsql/client
```

### Step 2: Create a Turso database per user

```bash
turso db create user-<userId>
turso db tokens create user-<userId>
```

In production, automate this with the Turso Platform API when a user signs up.

### Step 3: Replace the getUserDb wrapper

Create `src/lib/db/user-db-turso.ts`:

```ts
import { createClient, type Client } from '@libsql/client';

const clients = new Map<string, Client>();

export const getUserTursoDb = (userId: string): Client => {
  const cached = clients.get(userId);
  if (cached) return cached;

  const client = createClient({
    url: `libsql://user-${userId}.${process.env.TURSO_ORG}.turso.io`,
    authToken: process.env.TURSO_TOKEN,
  });

  clients.set(userId, client);
  return client;
};
```

With embedded replicas (local reads + cloud sync):

```ts
const client = createClient({
  url: `libsql://user-${userId}.${process.env.TURSO_ORG}.turso.io`,
  syncUrl: `file:data/users/${userId}/user.db`,
  authToken: process.env.TURSO_TOKEN,
});
await client.sync(); // sync on open
```

### Step 4: Adapt queries

`@libsql/client` is async. `db.run()` → `await db.execute()`:

```ts
// bun:sqlite (before)
const items = db.query<Item, []>('SELECT * FROM items').all();
db.run('INSERT INTO items ...', [id, title, now]);

// @libsql/client (after)
const result = await db.execute('SELECT * FROM items');
const items = result.rows as Item[];
await db.execute({ sql: 'INSERT INTO items ...', args: [id, title, now] });
```

`withWriteLock` is still needed: libSQL serializes at the network level but your application-level mutex prevents double-writes within the same process.

### Step 5: Adapt the migration runner

`runUserMigrations` uses `bun:sqlite` sync API. For Turso, run migrations async on first connection:

```ts
export const runUserMigrationsAsync = async (db: Client): Promise<void> => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _warpkit_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  for (const migration of USER_MIGRATIONS) {
    const applied = await db.execute({
      sql: 'SELECT id FROM _warpkit_migrations WHERE id = ?',
      args: [migration.id],
    });
    if (applied.rows.length > 0) continue;

    await migration.runAsync(db); // migrations need async variant
    await db.execute({
      sql: 'INSERT INTO _warpkit_migrations (id, applied_at) VALUES (?, ?)',
      args: [migration.id, Date.now()],
    });
  }
};
```

### Step 6: Migrate existing data

For each existing user SQLite file:

```bash
# Export from local SQLite
sqlite3 data/users/<userId>/user.db .dump > /tmp/user-dump.sql

# Import to Turso
turso db shell user-<userId> < /tmp/user-dump.sql
```

Or use the `exportMyData` server function to get a JSON export, then re-insert via the Turso client.

### Environment variables

```bash
TURSO_ORG=your-org-name
TURSO_TOKEN=your-auth-token
```

---

## Migration to PostgreSQL / Supabase

**Effort: Medium-High.** The per-user SQLite model doesn't map directly to PostgreSQL. You're not moving files: you're changing your data model.

### When to consider

- More than ~100k users where per-user SQLite file management becomes unwieldy
- Need multi-region read replicas (Supabase has this)
- Team already experienced with PostgreSQL
- Need full-text search, JSON operators, or other Postgres-specific features

### Key architecture change

Per-user SQLite: one DB file per user, no `user_id` columns needed.

PostgreSQL: shared database, every user-data table needs a `user_id` column and Row Level Security (RLS).

```sql
-- Before (per-user SQLite, no user_id needed)
CREATE TABLE items (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- After (PostgreSQL, shared schema)
CREATE TABLE items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_user ON items USING (user_id = auth.uid());
```

### What changes

- All user-data tables: add `user_id` column, enable RLS
- Query layer: switch from raw `bun:sqlite` to Drizzle with `pg` adapter
- Migration system: Drizzle migrations instead of `runUserMigrations`
- `withWriteLock`: not needed: Postgres handles concurrent writes natively
- `getUserDb`: replaced by a shared Drizzle client, always filter by `user_id`

### What stays the same

- Server function structure (`createServerFn`, `requireUser`, `ok`/`err`)
- Auth, billing, email: these already use the shared DB
- UUIDs: Postgres has a native `uuid` type, UUIDv7 strings store as `uuid` natively

### Data migration

Use `exportMyData` to get each user's JSON export, then re-insert into Postgres with `user_id` set. Or use `pgloader` with the SQLite source directly.

---

## Migration to MySQL / PlanetScale

**Effort: Medium-High.** Similar to PostgreSQL, plus PlanetScale-specific constraints.

### When to consider

- Existing MySQL expertise on the team
- Need Vitess horizontal sharding at extreme scale (millions of users, terabytes)
- Already on PlanetScale for other services

### PlanetScale-specific requirements

- Every table must have a `PRIMARY KEY`: Warpkit tables already do
- No foreign key constraints (Vitess doesn't support them): remove `REFERENCES` and enforce in application code
- Schema changes via PlanetScale's branch/deploy workflow, not direct `ALTER TABLE`
- UUIDs: UUIDv7 is critical here: InnoDB clustered indexes mean UUIDv4 causes severe page fragmentation at insert time

### Key architecture change

Same as PostgreSQL: shared schema, `user_id` on every table, all queries filter by user.

### What changes vs PostgreSQL

- Drizzle adapter: `mysql2` instead of `pg`
- No RLS: filter by `user_id` in all queries (enforce in application layer)
- No FK constraints: handle cascade deletes manually
- Timestamps: use `DATETIME` or `BIGINT` (milliseconds), not `TIMESTAMPTZ`
- PlanetScale deploy flow for schema changes

---

## Choosing the right target

| | Turso | PostgreSQL / Supabase | MySQL / PlanetScale |
|---|---|---|---|
| Effort | Low | Medium-High | Medium-High |
| Keeps per-user isolation | Yes | No (shared schema + RLS) | No (shared schema) |
| Best for | Cloud SQLite, edge deploys | Complex queries, multi-region | MySQL expertise, Vitess sharding |
| UUIDs | UUIDv7 fine | UUIDv7 native | UUIDv7 required |
| `withWriteLock` needed | Yes | No | No |
| Query rewrite | Minimal (async adapter) | Full rewrite | Full rewrite |
