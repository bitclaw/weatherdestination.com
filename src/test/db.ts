import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import {
  drizzleTimestampColumns,
  installTimestampGuards
} from '@/lib/db/timestamp-guards';
import { runUserMigrations } from '@/lib/db/user-migrations';
import { USER_DB_TIMESTAMP_COLUMNS } from '@/lib/db/user-timestamp-columns';

export const makeTestDb = (): Database => {
  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys = ON');
  runUserMigrations(db);
  installTimestampGuards(db, USER_DB_TIMESTAMP_COLUMNS);
  return db;
};

export const makeTestSharedDb = () => {
  const sqlite = new Database(':memory:');
  sqlite.run('PRAGMA foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  // Relative path is safe here: only ever invoked via 'bun run test'/'make
  // test' from repo root.
  migrate(db, { migrationsFolder: './drizzle' });
  installTimestampGuards(sqlite, drizzleTimestampColumns(schema));
  return db;
};
