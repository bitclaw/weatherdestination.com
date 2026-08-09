import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { runUserMigrations, validateMigrations } from './user-migrations';

describe('validateMigrations', () => {
  it('throws on duplicate migration ID', () => {
    const dupe = [
      { id: 'a', run: () => {} },
      { id: 'a', run: () => {} }
    ];
    expect(() => validateMigrations(dupe)).toThrow('Duplicate migration ID: a');
  });

  it('does not throw on distinct IDs', () => {
    const distinct = [
      { id: 'a', run: () => {} },
      { id: 'b', run: () => {} }
    ];
    expect(() => validateMigrations(distinct)).not.toThrow();
  });

  it('does not throw on empty array', () => {
    expect(() => validateMigrations([])).not.toThrow();
  });

  it('throws naming the first duplicate found', () => {
    const dupe = [
      { id: 'x', run: () => {} },
      { id: 'y', run: () => {} },
      { id: 'x', run: () => {} }
    ];
    expect(() => validateMigrations(dupe)).toThrow('x');
  });
});

describe('runUserMigrations', () => {
  it('creates all expected tables on a fresh DB', () => {
    const db = new Database(':memory:');
    runUserMigrations(db);
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all()
      .map(r => r.name);
    expect(tables).toContain('user_events');
    expect(tables).toContain('conversations');
    expect(tables).toContain('api_keys');
    expect(tables).toContain('notifications');
    expect(tables).toContain('notes');
    expect(tables).toContain('_warpkit_migrations');
  });

  it('is idempotent , running twice does not throw or duplicate rows', () => {
    const db = new Database(':memory:');
    runUserMigrations(db);
    runUserMigrations(db);
    const rows = db
      .query<{ id: string }, []>('SELECT id FROM _warpkit_migrations')
      .all();
    const ids = rows.map(r => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
