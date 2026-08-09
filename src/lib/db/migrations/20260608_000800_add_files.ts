import type { Database } from 'bun:sqlite';

export const migration = {
  id: '009_add_files',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        type       TEXT NOT NULL,
        size       INTEGER NOT NULL,
        s3_key     TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC, id DESC)'
    );
  }
};
