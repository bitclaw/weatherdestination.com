import type { Database } from 'bun:sqlite';

export const migration = {
  id: '007_add_notifications',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        body       TEXT,
        href       TEXT,
        read       INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read, created_at DESC)'
    );
  }
};
