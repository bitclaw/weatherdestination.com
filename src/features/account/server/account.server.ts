import type { Database } from 'bun:sqlite';

type SqliteRow = Record<string, string | number | boolean | null>;

// Columns that must never leave the server, even in the user's own data
// export: the export JSON lands in downloads folders and inboxes. api_keys
// key material is only ever shown once, at creation.
// settings.value is intentionally excluded from REDACTED_COLUMNS because
// users need their own settings (including encrypted secrets) in the export.
const REDACTED_COLUMNS: Record<string, readonly string[]> = {
  api_keys: ['key', 'key_hash']
};

export const dumpUserDbTables = (
  userDb: Database
): Record<string, SqliteRow[]> => {
  const tables = userDb
    .query<{ name: string }, []>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name != '_warpkit_migrations'`
    )
    .all();
  const data: Record<string, SqliteRow[]> = {};
  for (const { name } of tables) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(name)) continue;
    const rows = userDb.query<SqliteRow, []>(`SELECT * FROM "${name}"`).all();
    const redacted = REDACTED_COLUMNS[name];
    data[name] = redacted
      ? rows.map(row => {
          const copy = { ...row };
          for (const column of redacted) {
            if (column in copy) copy[column] = '[redacted]';
          }
          return copy;
        })
      : rows;
  }
  return data;
};
