import type { Database } from 'bun:sqlite';
import type { AuditEventRecord, JsonPayload } from '../audit-log.constants';

type EventRow = {
  id: string;
  type: string;
  payload: string | null;
  created_at: number;
};

const toView = (row: EventRow): AuditEventRecord => ({
  id: row.id,
  type: row.type,
  payload: row.payload ? (JSON.parse(row.payload) as JsonPayload) : null,
  created_at: row.created_at
});

// Capped: user_events has no retention/purge job, every mutation across the
// app appends to it indefinitely. Without a LIMIT this grows unbounded and
// the full history gets loaded and JSON-serialized on every page view.
const MAX_EVENTS = 500;

export const listAuditEvents = (db: Database): AuditEventRecord[] =>
  db
    .query<EventRow, []>(
      `SELECT * FROM user_events ORDER BY created_at DESC, id DESC LIMIT ${MAX_EVENTS}`
    )
    .all()
    .map(toView);
