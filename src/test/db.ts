import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import { runUserMigrations } from '@/lib/db/user-migrations';

export const makeTestDb = (): Database => {
  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys = ON');
  runUserMigrations(db);
  return db;
};

export const makeTestSharedDb = () => {
  const sqlite = new Database(':memory:');
  sqlite.run('PRAGMA foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  // Relative path is safe here: only ever invoked via 'bun run test'/'make
  // test' from repo root.
  migrate(db, { migrationsFolder: './drizzle' });
  return db;
};
