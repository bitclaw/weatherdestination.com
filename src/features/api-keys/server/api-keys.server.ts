import type { Database } from 'bun:sqlite';
import { err, ok } from '@bitclaw/result';
import { randomUUIDv7 } from 'bun';
import { ERROR_CODES } from '@/lib/constants';
import type { ApiKeyRecord, ApiKeyStatus } from '../api-keys.constants';

type ApiKeyRow = {
  id: string;
  name: string;
  key_hash: string;
  key_preview: string;
  status: string;
  last_used_at: number | null;
  created_at: number;
};

// wk_ prefix makes keys identifiable in logs and config files.
// Only SHA-256(key) is stored; the raw key is returned once from
// createApiKey and is unrecoverable afterwards. Verify a presented key
// by comparing hashKey(presented) against the key_hash column.
export const generateKey = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `wk_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
};

export const hashKey = (key: string): string =>
  new Bun.CryptoHasher('sha256').update(key).digest('hex');

export const maskKey = (key: string): string =>
  `${key.slice(0, 2)}_${'•'.repeat(8)}...${key.slice(-4)}`;

const toView = (row: ApiKeyRow): ApiKeyRecord => ({
  id: row.id,
  name: row.name,
  keyPreview: row.key_preview,
  status: row.status as ApiKeyStatus,
  last_used_at: row.last_used_at,
  created_at: row.created_at
});

export const listApiKeys = (db: Database): ApiKeyRecord[] =>
  db
    .query<ApiKeyRow, []>(
      'SELECT * FROM api_keys ORDER BY created_at DESC, id DESC'
    )
    .all()
    .map(toView);

export const createApiKey = (db: Database, input: { name: string }) => {
  const id = randomUUIDv7();
  const rawKey = generateKey();
  const now = Date.now();

  db.run(
    `INSERT INTO api_keys
       (id, name, key_hash, key_preview, status, last_used_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      hashKey(rawKey),
      maskKey(rawKey),
      'active',
      null,
      now
    ]
  );

  const row = db
    .query<ApiKeyRow, [string]>('SELECT * FROM api_keys WHERE id = ?')
    .get(id);
  if (!row) return err(ERROR_CODES.NOT_FOUND, 'Failed to create API key.');

  return ok({ record: toView(row), rawKey });
};

export const revokeApiKey = (db: Database, id: string) => {
  const existing = db
    .query<ApiKeyRow, [string]>('SELECT * FROM api_keys WHERE id = ?')
    .get(id);

  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'API key not found.');

  db.run('UPDATE api_keys SET status = ? WHERE id = ?', ['revoked', id]);

  return ok(toView({ ...existing, status: 'revoked' }));
};

export const deleteApiKey = (db: Database, id: string) => {
  const existing = db
    .query<{ id: string }, [string]>('SELECT id FROM api_keys WHERE id = ?')
    .get(id);

  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'API key not found.');

  db.run('DELETE FROM api_keys WHERE id = ?', [id]);
  return ok({ deleted: true });
};

// Called by app middleware on each authenticated API request.
// High-frequency , does not log a user event.
export const touchApiKey = (db: Database, id: string): void => {
  db.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', [Date.now(), id]);
};
