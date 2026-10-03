import type { Database } from 'bun:sqlite';
import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

// Enforces docs/warpkit/patterns/timestamps.md at the database: every
// timestamp column gets BEFORE INSERT/UPDATE triggers that abort a write of
// text, a non-integer, or a seconds-scale number. 0 ("never") and NULL pass.
// Installed on every open (tests and production alike), so a wrong-unit
// write fails at the line that makes it instead of storing a 1970 date.

/** 1e11 ms is 1973-03-03; a seconds value stays below it until the year 5138. */
export const MIN_EPOCH_MS = 100_000_000_000;

// Bump when the predicate changes so old triggers are replaced, not kept.
const VERSION = 'v1';

export type TimestampColumns = Record<string, readonly string[]>;

const triggerName = (table: string, column: string, op: 'ins' | 'upd') =>
  `tsguard_${VERSION}_${table}_${column}_${op}`;

export const installTimestampGuards = (
  db: Database,
  columns: TimestampColumns
) => {
  const tables = new Set(
    db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
      )
      .all()
      .map(t => t.name)
  );
  for (const [table, cols] of Object.entries(columns)) {
    // A table a later migration creates gets its guards on the next open.
    if (!tables.has(table)) continue;
    for (const column of cols) {
      const value = `NEW."${column}"`;
      const bad = `${value} IS NOT NULL AND (typeof(${value}) <> 'integer' OR (${value} <> 0 AND ${value} < ${MIN_EPOCH_MS}))`;
      const message = `timestamp guard: ${table}.${column} must be epoch ms (see docs/warpkit/patterns/timestamps.md)`;
      for (const [op, event] of [
        ['ins', 'INSERT'],
        ['upd', 'UPDATE']
      ] as const) {
        db.run(
          `CREATE TRIGGER IF NOT EXISTS "${triggerName(table, column, op)}"
           BEFORE ${event} ON "${table}" FOR EACH ROW WHEN ${bad}
           BEGIN SELECT RAISE(ABORT, '${message}'); END`
        );
      }
    }
  }
};

/** The guard triggers present in a DB, for the coverage tests. */
export const installedGuards = (db: Database): Set<string> =>
  new Set(
    db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'tsguard\\_%' ESCAPE '\\'"
      )
      .all()
      .map(t => t.name)
  );

export const guardTriggerNames = (columns: TimestampColumns) =>
  Object.entries(columns).flatMap(([table, cols]) =>
    cols.flatMap(column => [
      triggerName(table, column, 'ins'),
      triggerName(table, column, 'upd')
    ])
  );

/** Every Drizzle timestamp column in a schema module, by table. */
export const drizzleTimestampColumns = (
  // weak-type-ok: a schema module exports tables and relations side by side; tables are narrowed with is() below
  schema: Record<string, unknown>
): TimestampColumns => {
  const columns: Record<string, string[]> = {};
  for (const table of Object.values(schema)) {
    if (!is(table, SQLiteTable)) continue;
    const names = Object.values(getTableColumns(table))
      .filter(c => c.columnType === 'SQLiteTimestamp')
      .map(c => c.name);
    if (names.length) columns[getTableName(table)] = names;
  }
  return columns;
};
