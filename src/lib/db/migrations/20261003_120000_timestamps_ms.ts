import type { Database } from 'bun:sqlite';

// Per-user DB times are epoch ms (docs/warpkit/patterns/timestamps.md), but
// setSetting wrote settings.updated_at with unixepoch() (seconds), and the
// settings table's DEFAULT is unixepoch() too. Convert any seconds-scale
// value in every timestamp column; values already >= 1e11 (ms) are never
// touched, so this can't double a value and is safe to re-run.
// Frozen local list: migrations must not import app code that can drift.
const COLUMNS: Record<string, string[]> = {
  user_events: ['created_at'],
  conversations: ['created_at', 'updated_at'],
  chat_messages: ['created_at'],
  feature_requests: ['created_at', 'updated_at'],
  notifications: ['created_at'],
  notes: ['created_at', 'updated_at'],
  files: ['created_at'],
  settings: ['updated_at'],
  api_keys: ['last_used_at', 'created_at']
};

// One UPDATE per table converts all its timestamp columns together, so a
// row is never half-converted (the guard triggers check every column).
const toMs = (column: string) =>
  `"${column}" = CASE WHEN typeof("${column}") = 'integer' AND "${column}" > 0 AND "${column}" < 100000000000 THEN "${column}" * 1000 ELSE "${column}" END`;

export const migration = {
  id: '012_timestamps_ms',
  run: (db: Database) => {
    for (const [table, columns] of Object.entries(COLUMNS)) {
      db.run(`UPDATE "${table}" SET ${columns.map(toMs).join(', ')}`);
    }
  }
};
