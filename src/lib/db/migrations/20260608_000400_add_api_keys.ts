import type { Database } from 'bun:sqlite';

export const migration = {
  id: '005_add_api_keys',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        key          TEXT NOT NULL UNIQUE,
        status       TEXT NOT NULL DEFAULT 'active',
        last_used_at INTEGER,
        created_at   INTEGER NOT NULL
      )
    `);
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status)'
    );
  }
};
