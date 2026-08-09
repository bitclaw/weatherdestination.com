import type { Database } from 'bun:sqlite';

export const migration = {
  id: '006_add_feature_requests',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS feature_requests (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT,
        status      TEXT NOT NULL DEFAULT 'submitted',
        priority    TEXT NOT NULL DEFAULT 'medium',
        category    TEXT NOT NULL DEFAULT 'other',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER
      )
    `);
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status)'
    );
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_feature_requests_priority ON feature_requests(priority)'
    );
  }
};
