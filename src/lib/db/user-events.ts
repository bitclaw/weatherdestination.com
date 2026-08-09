import type { Database } from 'bun:sqlite';
import { randomUUIDv7 } from 'bun';

export const logUserEvent = (
  db: Database,
  type: string,
  // weak-type-ok: audit-log payload is heterogeneous by design, JSON.stringify'd opaque
  payload?: Record<string, unknown>
): void => {
  db.run(
    'INSERT INTO user_events (id, type, payload, created_at) VALUES (?, ?, ?, ?)',
    [randomUUIDv7(), type, payload ? JSON.stringify(payload) : null, Date.now()]
  );
};
