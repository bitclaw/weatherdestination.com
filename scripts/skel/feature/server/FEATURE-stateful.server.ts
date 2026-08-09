/**
 * Stateful entity variant , use when the entity has a lifecycle with valid/invalid
 * transitions (jobs, deployments, orders, builds, etc.).
 *
 * Replace FEATURE/Entity/entity/entities throughout. Adjust VALID_TRANSITIONS,
 * statuses, and transition fns to match your domain.
 *
 * Rename this file to FEATURE.server.ts and delete the plain FEATURE.server.ts.
 */
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
  label: string; // replace with your domain columns
  status: string;
  started_at: number | null;
  finished_at: number | null;
  created_at: number;
  updated_at: number;
};

export type CreateEntityInput = {
  label: string; // replace with your domain fields
};

// Define every status → allowed next statuses. Terminal states get empty arrays.
const VALID_TRANSITIONS: Record<EntityStatus, EntityStatus[]> = {
  pending: ['running', 'cancelled'],
  running: ['success', 'failed', 'cancelled'],
  success: [],
  failed: [],
  cancelled: []
};

// toView is the only place a raw row becomes a public record.
const toView = (row: EntityRow): EntityRecord => ({
  id: row.id,
  status: row.status as EntityStatus,
  started_at: row.started_at,
  finished_at: row.finished_at,
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
    label: input.label.trim(),
    status: 'pending',
    started_at: null,
    finished_at: null,
    created_at: now,
    updated_at: now
  };

  db.run(
    `INSERT INTO entities (id, label, status, started_at, finished_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.label,
      row.status,
      row.started_at,
      row.finished_at,
      row.created_at,
      row.updated_at
    ]
  );

  return ok(toView(row));
};

// Named transition fns , one per valid move in the state machine.
// Each fn: check exists → check transition → UPDATE → return Result.

export const startEntity = (db: Database, id: string) => {
  const existing = db
    .query<EntityRow, [string]>('SELECT * FROM entities WHERE id = ?')
    .get(id);
  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'Entity not found.');
  const current = existing.status as EntityStatus;
  if (!VALID_TRANSITIONS[current].includes('running'))
    return err(
      ERROR_CODES.CONFLICT,
      `Cannot transition entity from '${current}' to 'running'.`
    );

  const now = Date.now();
  db.run(
    'UPDATE entities SET status = ?, started_at = ?, updated_at = ? WHERE id = ?',
    ['running', now, now, id]
  );
  return ok(
    toView({ ...existing, status: 'running', started_at: now, updated_at: now })
  );
};

export const completeEntity = (db: Database, id: string) => {
  const existing = db
    .query<EntityRow, [string]>('SELECT * FROM entities WHERE id = ?')
    .get(id);
  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'Entity not found.');
  const current = existing.status as EntityStatus;
  if (!VALID_TRANSITIONS[current].includes('success'))
    return err(
      ERROR_CODES.CONFLICT,
      `Cannot transition entity from '${current}' to 'success'.`
    );

  const now = Date.now();
  db.run(
    'UPDATE entities SET status = ?, finished_at = ?, updated_at = ? WHERE id = ?',
    ['success', now, now, id]
  );
  return ok(
    toView({
      ...existing,
      status: 'success',
      finished_at: now,
      updated_at: now
    })
  );
};

export const failEntity = (db: Database, id: string) => {
  const existing = db
    .query<EntityRow, [string]>('SELECT * FROM entities WHERE id = ?')
    .get(id);
  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'Entity not found.');
  const current = existing.status as EntityStatus;
  if (!VALID_TRANSITIONS[current].includes('failed'))
    return err(
      ERROR_CODES.CONFLICT,
      `Cannot transition entity from '${current}' to 'failed'.`
    );

  const now = Date.now();
  db.run(
    'UPDATE entities SET status = ?, finished_at = ?, updated_at = ? WHERE id = ?',
    ['failed', now, now, id]
  );
  return ok(
    toView({ ...existing, status: 'failed', finished_at: now, updated_at: now })
  );
};

export const cancelEntity = (db: Database, id: string) => {
  const existing = db
    .query<EntityRow, [string]>('SELECT * FROM entities WHERE id = ?')
    .get(id);
  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'Entity not found.');
  const current = existing.status as EntityStatus;
  if (!VALID_TRANSITIONS[current].includes('cancelled'))
    return err(
      ERROR_CODES.CONFLICT,
      `Cannot transition entity from '${current}' to 'cancelled'.`
    );

  const now = Date.now();
  db.run('UPDATE entities SET status = ?, updated_at = ? WHERE id = ?', [
    'cancelled',
    now,
    id
  ]);
  return ok(toView({ ...existing, status: 'cancelled', updated_at: now }));
};
