import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { ERROR_CODES } from '@/lib/constants';
import { migration as hashApiKeysMigration } from '@/lib/db/migrations/20260702_220044_hash_api_keys';
import { makeTestDb } from '@/test/db';
import {
  createApiKey,
  deleteApiKey,
  hashKey,
  listApiKeys,
  maskKey,
  revokeApiKey,
  touchApiKey
} from './api-keys.server';

describe('api-keys.server', () => {
  it('returns empty list for fresh DB', () => {
    const db = makeTestDb();
    expect(listApiKeys(db)).toEqual([]);
  });

  it('creates a key and returns masked record + rawKey', () => {
    const db = makeTestDb();
    const result = createApiKey(db, { name: 'My App' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.record.name).toBe('My App');
    expect(result.data.record.status).toBe('active');
    expect(result.data.rawKey).toMatch(/^wk_[0-9a-f]{32}$/);
    expect(result.data.record.keyPreview).not.toContain(result.data.rawKey);
    expect(result.data.record.last_used_at).toBeNull();
  });

  it('never exposes raw key in list', () => {
    const db = makeTestDb();
    const result = createApiKey(db, { name: 'Secret' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const list = listApiKeys(db);
    expect(list).toHaveLength(1);
    const record = list[0];
    expect(record).toBeDefined();
    if (!record) return;
    expect(JSON.stringify(record)).not.toContain(result.data.rawKey);
  });

  it('lists keys newest first', () => {
    const db = makeTestDb();
    createApiKey(db, { name: 'First' });
    createApiKey(db, { name: 'Second' });

    const list = listApiKeys(db);
    expect(list).toHaveLength(2);
    expect(list[0]?.name).toBe('Second');
    expect(list[1]?.name).toBe('First');
  });

  it('revokes a key', () => {
    const db = makeTestDb();
    const created = createApiKey(db, { name: 'To revoke' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const revoked = revokeApiKey(db, created.data.record.id);
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(revoked.data.status).toBe('revoked');

    const list = listApiKeys(db);
    expect(list[0]?.status).toBe('revoked');
  });

  it('revoking an already-revoked key is idempotent', () => {
    const db = makeTestDb();
    const created = createApiKey(db, { name: 'Revoke twice' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    revokeApiKey(db, created.data.record.id);
    const second = revokeApiKey(db, created.data.record.id);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.status).toBe('revoked');
  });

  it('deletes a key', () => {
    const db = makeTestDb();
    const created = createApiKey(db, { name: 'Delete me' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deleted = deleteApiKey(db, created.data.record.id);
    expect(deleted.ok).toBe(true);
    expect(listApiKeys(db)).toHaveLength(0);
  });

  it('returns NOT_FOUND when revoking nonexistent key', () => {
    const db = makeTestDb();
    const result = revokeApiKey(db, 'ghost');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('returns NOT_FOUND for nonexistent delete', () => {
    const db = makeTestDb();
    const result = deleteApiKey(db, 'ghost');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('maskKey formats correctly', () => {
    const key = 'wk_abcdef1234567890abcdef1234567890';
    const masked = maskKey(key);
    expect(masked).toContain('••••••••');
    expect(masked).toEndWith('7890');
    expect(masked).not.toContain('abcdef1234567890abcdef');
  });

  it('maskKey produces wk_ prefix with single underscore', () => {
    const key = 'wk_abcdef1234567890abcdef1234567890';
    const masked = maskKey(key);
    expect(masked).toStartWith('wk_•');
    expect(masked).not.toStartWith('wk__');
  });

  it('touchApiKey updates last_used_at for the target key only', () => {
    const db = makeTestDb();
    const target = createApiKey(db, { name: 'Target' });
    const other = createApiKey(db, { name: 'Other' });
    expect(target.ok).toBe(true);
    expect(other.ok).toBe(true);
    if (!target.ok || !other.ok) return;

    touchApiKey(db, target.data.record.id);

    const list = listApiKeys(db);
    const touched = list.find(k => k.id === target.data.record.id);
    const untouched = list.find(k => k.id === other.data.record.id);
    expect(touched?.last_used_at).not.toBeNull();
    expect(untouched?.last_used_at).toBeNull();
    expect(touched?.name).toBe('Target');
    expect(touched?.status).toBe('active');
  });

  it('stores only the hash, never the raw key', () => {
    const db = makeTestDb();
    const result = createApiKey(db, { name: 'Hashed' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = db
      .query<Record<string, string | number | null>, [string]>(
        'SELECT * FROM api_keys WHERE id = ?'
      )
      .get(result.data.record.id);
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.key_hash).toBe(hashKey(result.data.rawKey));
    expect(JSON.stringify(row)).not.toContain(result.data.rawKey);
    expect('key' in row).toBe(false);
  });
});

describe('011_hash_api_keys migration', () => {
  const makePreMigrationDb = (): Database => {
    const db = new Database(':memory:');
    // Frozen 005_add_api_keys shape: plaintext key column.
    db.run(`
      CREATE TABLE api_keys (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        key          TEXT NOT NULL UNIQUE,
        status       TEXT NOT NULL DEFAULT 'active',
        last_used_at INTEGER,
        created_at   INTEGER NOT NULL
      )
    `);
    return db;
  };

  it('backfills key_hash and key_preview from plaintext keys', () => {
    const db = makePreMigrationDb();
    const raw = 'wk_abcdef1234567890abcdef1234567890';
    db.run(
      `INSERT INTO api_keys (id, name, key, status, last_used_at, created_at)
       VALUES ('k1', 'Legacy', ?, 'revoked', 42, 1000)`,
      [raw]
    );

    hashApiKeysMigration.run(db);

    const row = db
      .query<Record<string, string | number | null>, []>(
        'SELECT * FROM api_keys'
      )
      .get();
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.key_hash).toBe(hashKey(raw));
    expect(row.key_preview).toBe(maskKey(raw));
    expect(row.status).toBe('revoked');
    expect(row.last_used_at).toBe(42);
    expect('key' in row).toBe(false);
  });

  it('is a no-op on an already-migrated table', () => {
    const db = makeTestDb(); // migrations already applied, new shape
    createApiKey(db, { name: 'Post-migration' });
    hashApiKeysMigration.run(db); // must not throw or drop rows
    expect(listApiKeys(db)).toHaveLength(1);
  });
});
