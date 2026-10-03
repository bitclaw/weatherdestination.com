import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { getTableColumns, is } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { SQLiteTable, SQLiteTimestamp } from 'drizzle-orm/sqlite-core';
import { getSetting, setSetting } from '@/lib/db/settings-helpers.server';
import { makeTestDb, makeTestSharedDb } from '@/test/db';
import { migration as timestampsMs } from './migrations/20261003_120000_timestamps_ms';
import * as schema from './schema';
import {
  drizzleTimestampColumns,
  guardTriggerNames,
  installedGuards,
  MIN_EPOCH_MS
} from './timestamp-guards';
import { runUserMigrations } from './user-migrations';
import {
  USER_DB_NON_TIMESTAMP_INTEGERS,
  USER_DB_TIMESTAMP_COLUMNS
} from './user-timestamp-columns';

// docs/warpkit/patterns/timestamps.md: every stored instant is epoch ms,
// enforced by triggers on every SQLite DB.

const NOW = 1_790_000_000_000;
const SECONDS = 1_790_000_000;

const insertNote = (db: Database, createdAt: unknown) =>
  db.run(
    'INSERT INTO notes (id, title, content, pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
    [crypto.randomUUID(), 't', 'c', createdAt as number, NOW]
  );

describe('timestamp guards', () => {
  it('reject seconds, text and fractions; allow ms, 0 and NULL', () => {
    const db = makeTestDb();
    expect(() => insertNote(db, SECONDS)).toThrow(
      /notes\.created_at must be epoch ms/
    );
    expect(() => insertNote(db, '2026-10-03 14:10:12')).toThrow(/epoch ms/);
    expect(() => insertNote(db, NOW + 0.5)).toThrow(/epoch ms/);
    expect(() => insertNote(db, NOW)).not.toThrow();
    expect(() => insertNote(db, 0)).not.toThrow();
    db.run(
      "INSERT INTO api_keys (id, name, key_hash, key_preview, created_at) VALUES ('k', 'n', 'h', 'p', ?)",
      [NOW]
    );
    expect(() =>
      db.run("UPDATE api_keys SET last_used_at = NULL WHERE id = 'k'")
    ).not.toThrow();
    expect(() =>
      db.run("UPDATE api_keys SET last_used_at = ? WHERE id = 'k'", [SECONDS])
    ).toThrow(/api_keys\.last_used_at/);
  });

  it('threshold: real seconds are far below it, real ms far above', () => {
    expect(Math.floor(Date.now() / 1000)).toBeLessThan(MIN_EPOCH_MS);
    expect(Date.now()).toBeGreaterThan(MIN_EPOCH_MS);
  });
});

describe('per-user DB coverage', () => {
  it('classifies every INTEGER column as a timestamp or not', () => {
    const db = new Database(':memory:');
    runUserMigrations(db);
    const unclassified: string[] = [];
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .all();
    for (const { name: table } of tables) {
      const ints = db
        .query<{ name: string; type: string }, []>(
          `SELECT name, type FROM pragma_table_info('${table}')`
        )
        .all()
        .filter(c => c.type.toUpperCase().includes('INT'));
      for (const { name } of ints) {
        const known =
          USER_DB_TIMESTAMP_COLUMNS[table]?.includes(name) ||
          USER_DB_NON_TIMESTAMP_INTEGERS[table]?.includes(name);
        if (!known) unclassified.push(`${table}.${name}`);
      }
    }
    // A new INTEGER column must go in user-timestamp-columns.ts, either list.
    expect(unclassified).toEqual([]);
  });

  it('installs a guard for every listed timestamp column', () => {
    const installed = installedGuards(makeTestDb());
    for (const name of guardTriggerNames(USER_DB_TIMESTAMP_COLUMNS)) {
      expect(installed.has(name)).toBe(true);
    }
  });
});

describe('shared DB coverage', () => {
  it('stores every Drizzle timestamp in ms', () => {
    const seconds: string[] = [];
    for (const table of Object.values(schema)) {
      if (!is(table, SQLiteTable)) continue;
      for (const column of Object.values(getTableColumns(table))) {
        if (is(column, SQLiteTimestamp) && column.mode !== 'timestamp_ms') {
          seconds.push(column.name);
        }
      }
    }
    expect(seconds).toEqual([]);
  });

  it('installs a guard for every Drizzle timestamp column', () => {
    const db = makeTestSharedDb();
    const installed = installedGuards(db.$client);
    const expected = guardTriggerNames(drizzleTimestampColumns(schema));
    expect(expected.length).toBeGreaterThan(40);
    for (const name of expected) expect(installed.has(name)).toBe(true);
  });

  it('writes a Date through Drizzle as epoch ms', () => {
    const db = makeTestSharedDb();
    const at = new Date(NOW);
    db.insert(schema.users)
      .values({
        id: 'u1',
        name: 'U',
        email: 'u@example.com',
        createdAt: at,
        updatedAt: at
      })
      .run();
    const row = db.$client
      .query<{ created_at: number }, []>(
        "SELECT created_at FROM users WHERE id = 'u1'"
      )
      .get();
    expect(row?.created_at).toBe(NOW);
  });
});

describe('timestamp migrations', () => {
  it('per-user 012 converts seconds to ms and leaves ms alone', () => {
    const db = new Database(':memory:');
    runUserMigrations(db);
    db.run(
      "INSERT INTO notes (id, title, content, pinned, created_at, updated_at) VALUES ('s', 't', 'c', 0, ?, ?), ('m', 't', 'c', 0, ?, ?)",
      [SECONDS, SECONDS, NOW, NOW]
    );
    db.run(
      "INSERT INTO settings (key, value, updated_at) VALUES ('k', 'v', ?)",
      [SECONDS]
    );
    timestampsMs.run(db);
    timestampsMs.run(db); // re-running is a no-op
    expect(
      db.query('SELECT id, created_at, updated_at FROM notes ORDER BY id').all()
    ).toEqual([
      { id: 'm', created_at: NOW, updated_at: NOW },
      { id: 's', created_at: SECONDS * 1000, updated_at: SECONDS * 1000 }
    ]);
    expect(
      db.query("SELECT updated_at FROM settings WHERE key = 'k'").get()
    ).toEqual({
      updated_at: SECONDS * 1000
    });
  });

  it('shared 0005 converts seconds to ms and leaves ms alone', async () => {
    const sqlite = new Database(':memory:');
    migrate(drizzle(sqlite), { migrationsFolder: './drizzle' });
    sqlite.run(
      "INSERT INTO users (id, name, email, email_verified, created_at, updated_at) VALUES ('s', 'S', 's@x.io', 0, ?, ?), ('m', 'M', 'm@x.io', 0, ?, ?)",
      [SECONDS, SECONDS, NOW, NOW]
    );
    const file = await Bun.file('./drizzle/0005_timestamps_ms.sql').text();
    for (const statement of file.split('--> statement-breakpoint')) {
      sqlite.run(statement);
    }
    expect(
      sqlite
        .query('SELECT id, created_at, updated_at FROM users ORDER BY id')
        .all()
    ).toEqual([
      { id: 'm', created_at: NOW, updated_at: NOW },
      { id: 's', created_at: SECONDS * 1000, updated_at: SECONDS * 1000 }
    ]);
  });
});

describe('settings helper', () => {
  it('stamps updated_at in epoch ms', () => {
    const db = makeTestDb();
    setSetting(db, 'theme', 'dark');
    const row = db
      .query<{ updated_at: number }, []>(
        "SELECT updated_at FROM settings WHERE key = 'theme'"
      )
      .get();
    expect(getSetting(db, 'theme')).toBe('dark');
    expect(row?.updated_at).toBeGreaterThan(Date.now() - 60_000);
    expect(row?.updated_at).toBeLessThanOrEqual(Date.now());
  });
});
