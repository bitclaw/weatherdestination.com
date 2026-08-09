import type { Database } from 'bun:sqlite';

export const migration = {
  id: '000_initial_schema',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS _warpkit_migrations (
        id         TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )
    `);
  }
};
