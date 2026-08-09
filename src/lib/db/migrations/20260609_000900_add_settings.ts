import type { Database } from 'bun:sqlite';

export const migration = {
  id: '010_add_settings',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
  }
};
