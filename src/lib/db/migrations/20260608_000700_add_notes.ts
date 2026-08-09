import type { Database } from 'bun:sqlite';

export const migration = {
  id: '008_add_notes',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        content    TEXT NOT NULL DEFAULT '',
        pinned     INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_notes_list ON notes(pinned DESC, updated_at DESC)'
    );
  }
};
