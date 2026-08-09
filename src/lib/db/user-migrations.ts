import type { Database } from 'bun:sqlite';
import { migration as m000 } from './migrations/20260608_000000_initial_schema';
import { migration as m001 } from './migrations/20260608_000100_add_user_events';
import { migration as m003 } from './migrations/20260608_000300_add_conversations';
import { migration as m004 } from './migrations/20260608_000400_add_api_keys';
import { migration as m005 } from './migrations/20260608_000500_add_feature_requests';
import { migration as m006 } from './migrations/20260608_000600_add_notifications';
import { migration as m007 } from './migrations/20260608_000700_add_notes';
import { migration as m008 } from './migrations/20260608_000800_add_files';
import { migration as m009 } from './migrations/20260609_000900_add_settings';
import { migration as m011 } from './migrations/20260702_220044_hash_api_keys';

// =============================================================================
// USER DATABASE MIGRATION RUNNER
// =============================================================================
// Migrations live in src/lib/db/migrations/ as individual files.
// Naming convention: YYYYMMDD_HHMMSS_description.ts
//
// Rules:
//   - Never remove or reorder an entry once applied to any DB
//   - Never change the id or run body of an applied migration
//   - Append new migrations at the end of USER_MIGRATIONS
//   - New file: use current timestamp as prefix (date +%Y%m%d_%H%M%S)
//
// No down migrations: write a new forward migration to undo.
//
// ID note: import aliases skip m002 (migration was deleted before release).
// Embedded migration IDs start at 004 for m003 onward. Gap is intentional
// and frozen. Deployed user DBs have these IDs in _warpkit_migrations; never
// renumber. Sequence gaps are fine: IDs are arbitrary stable strings, not indexes.
// =============================================================================

export type UserMigration = {
  id: string;
  run: (db: Database) => void;
};

export const USER_MIGRATIONS: UserMigration[] = [
  m000,
  m001,
  m003,
  m004,
  m005,
  m006,
  m007,
  m008,
  m009,
  m011
];

export const validateMigrations = (migrations: UserMigration[]): void => {
  const seenIds = new Set<string>();
  for (const m of migrations) {
    if (seenIds.has(m.id)) throw new Error(`Duplicate migration ID: ${m.id}`);
    seenIds.add(m.id);
  }
};

export const runUserMigrations = (db: Database): void => {
  validateMigrations(USER_MIGRATIONS);
  db.run(`
    CREATE TABLE IF NOT EXISTS _warpkit_migrations (
      id         TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = new Set(
    db
      .query<{ id: string }, []>('SELECT id FROM _warpkit_migrations')
      .all()
      .map(r => r.id)
  );

  for (const migration of USER_MIGRATIONS) {
    if (applied.has(migration.id)) continue;

    db.transaction(() => {
      migration.run(db);
      db.run('INSERT INTO _warpkit_migrations (id, applied_at) VALUES (?, ?)', [
        migration.id,
        Date.now()
      ]);
    })();
  }
};
