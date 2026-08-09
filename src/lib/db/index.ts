import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { setWalModeWithRetry } from '@bitclaw/sqlite/wal-mode';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';
import { sqlLog } from './sql-logger';

// weak-type-ok: standard globalThis-extension idiom, no structural TS way to type this
const globalForDb = globalThis as unknown as {
  metaDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
  metaSqlite: Database | undefined;
};

const createDb = () => {
  const dbPath =
    process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'data', 'meta.db');

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  // busy_timeout first: correct for ordinary statement contention. The
  // WAL-mode switch itself needs its own retry loop regardless - see
  // @bitclaw/sqlite/wal-mode's setWalModeWithRetry for why busy_timeout
  // alone doesn't cover it.
  sqlite.run('PRAGMA busy_timeout = 10000');
  setWalModeWithRetry(sqlite);
  sqlite.run('PRAGMA synchronous = NORMAL');
  sqlite.run('PRAGMA cache_size = -20000');
  sqlite.run('PRAGMA temp_store = MEMORY');
  sqlite.run('PRAGMA mmap_size = 268435456');
  sqlite.run('PRAGMA foreign_keys = ON');

  const checkpointInterval = setInterval(() => {
    try {
      sqlite.run('PRAGMA wal_checkpoint(PASSIVE)');
      sqlite.run('PRAGMA optimize');
    } catch {
      // Non-critical
    }
  }, 300_000);
  if (checkpointInterval.unref) {
    checkpointInterval.unref();
  }

  const logger = {
    logQuery(query: string, params: unknown[]) {
      sqlLog.debug({ params }, query);
    }
  };

  return { sqlite, drizzleDb: drizzle(sqlite, { schema, logger }) };
};

const instance = globalForDb.metaDb
  ? {
      sqlite: globalForDb.metaSqlite as Database,
      drizzleDb: globalForDb.metaDb
    }
  : createDb();

export const db = instance.drizzleDb;

// Raw handle for shutdown (WAL checkpoint + close) - server/start.ts's
// SIGTERM handler needs this; nothing else should reach past the Drizzle
// wrapper for day-to-day queries.
export const closeSharedDb = (): void => {
  try {
    instance.sqlite.run('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch {
    // Best-effort - still close even if the checkpoint fails.
  }
  instance.sqlite.close();
};

if (process.env.NODE_ENV !== 'production') {
  globalForDb.metaDb = instance.drizzleDb;
  globalForDb.metaSqlite = instance.sqlite;
}
