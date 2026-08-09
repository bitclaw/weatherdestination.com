import type { Database } from 'bun:sqlite';

export const migration = {
  id: '001_add_user_events',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS user_events (
        id         TEXT PRIMARY KEY,
        type       TEXT NOT NULL,
        payload    TEXT,
        created_at INTEGER NOT NULL
      )
    `);
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(type)'
    );
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at)'
    );
  }
};
