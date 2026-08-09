import type { Database } from 'bun:sqlite';
import { err, ok } from '@bitclaw/result';
import { randomUUIDv7 } from 'bun';
import {
  ENTITY_STATUSES,
  type EntityRecord,
  type EntityStatus
} from '@/features/FEATURE/FEATURE.constants';
import { ERROR_CODES } from '@/lib/constants';

export { ENTITY_STATUSES, type EntityRecord, type EntityStatus };

// Internal row , mirrors raw SQLite columns. Never return from server fns.
type EntityRow = {
  id: string;
  title: string;
  status: string;
  created_at: number;
  updated_at: number | null;
};

export type CreateEntityInput = {
  title: string;
  status?: EntityStatus;
};

export type UpdateEntityInput = {
  id: string;
  title: string;
  status?: EntityStatus;
};

// toView is the only place a raw row becomes a public record.
const toView = (row: EntityRow): EntityRecord => ({
  id: row.id,
  title: row.title,
  status: row.status as EntityStatus,
  created_at: row.created_at,
  updated_at: row.updated_at
});

export const listEntities = (db: Database): EntityRecord[] =>
  db
    .query<EntityRow, []>(
      'SELECT * FROM entities ORDER BY created_at DESC, id DESC'
    )
    .all()
    .map(toView);

export const getEntityById = (
  db: Database,
  id: string
): EntityRecord | null => {
  const row = db
    .query<EntityRow, [string]>('SELECT * FROM entities WHERE id = ?')
    .get(id);
  return row ? toView(row) : null;
};

export const createEntity = (db: Database, input: CreateEntityInput) => {
  const now = Date.now();
  const row: EntityRow = {
    id: randomUUIDv7(),
    title: input.title.trim(),
    status: input.status ?? 'active',
    created_at: now,
    updated_at: null
  };

  db.run(
    'INSERT INTO entities (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [row.id, row.title, row.status, row.created_at, row.updated_at]
  );

  return ok(toView(row));
};

export const updateEntity = (db: Database, input: UpdateEntityInput) => {
  const existing = db
    .query<EntityRow, [string]>('SELECT * FROM entities WHERE id = ?')
    .get(input.id);

  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'Entity not found.');

  const now = Date.now();
  db.run(
    'UPDATE entities SET title = ?, status = ?, updated_at = ? WHERE id = ?',
    [input.title.trim(), input.status ?? existing.status, now, input.id]
  );

  return ok(
    toView({
      ...existing,
      title: input.title.trim(),
      status: input.status ?? existing.status,
      updated_at: now
    })
  );
};

export const deleteEntity = (db: Database, id: string) => {
  const existing = db
    .query<{ id: string }, [string]>('SELECT id FROM entities WHERE id = ?')
    .get(id);

  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'Entity not found.');
  db.run('DELETE FROM entities WHERE id = ?', [id]);
  return ok({ deleted: true });
};
