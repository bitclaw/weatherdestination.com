import type { Database } from 'bun:sqlite';

// Frozen local copies: migrations must not import app code that can drift.
const sha256Hex = (value: string): string =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex');

const maskKey = (key: string): string =>
  `${key.slice(0, 2)}_${'•'.repeat(8)}...${key.slice(-4)}`;

// Replace plaintext `key` with `key_hash` (SHA-256 hex) + `key_preview`.
// Table rebuild instead of DROP COLUMN: SQLite refuses to drop a column
// backed by an index, and `key` was declared UNIQUE in 005_add_api_keys.
export const migration = {
  id: '011_hash_api_keys',
  run: (db: Database) => {
    const cols = db
      .query<{ name: string }, []>('PRAGMA table_info(api_keys)')
      .all();
    if (!cols.some(c => c.name === 'key')) return; // already migrated

    db.run(`
      CREATE TABLE IF NOT EXISTS api_keys_new (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        key_hash     TEXT NOT NULL UNIQUE,
        key_preview  TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'active',
        last_used_at INTEGER,
        created_at   INTEGER NOT NULL
      )
    `);

    const rows = db
      .query<
        {
          id: string;
          name: string;
          key: string;
          status: string;
          last_used_at: number | null;
          created_at: number;
        },
        []
      >('SELECT id, name, key, status, last_used_at, created_at FROM api_keys')
      .all();

    for (const row of rows) {
      db.run(
        `INSERT INTO api_keys_new
           (id, name, key_hash, key_preview, status, last_used_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.name,
          sha256Hex(row.key),
          maskKey(row.key),
          row.status,
          row.last_used_at,
          row.created_at
        ]
      );
    }

    db.run('DROP TABLE api_keys');
    db.run('ALTER TABLE api_keys_new RENAME TO api_keys');
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status)'
    );
  }
};
