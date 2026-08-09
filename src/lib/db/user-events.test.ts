import { describe, expect, it } from 'bun:test';
import { makeTestDb } from '@/test/db';
import { logUserEvent } from './user-events';

type EventRow = {
  id: string;
  type: string;
  payload: string | null;
  created_at: number;
};

describe('logUserEvent', () => {
  it('inserts row with correct type', () => {
    const db = makeTestDb();
    logUserEvent(db, 'item.created');
    const rows = db.query<EventRow, []>('SELECT * FROM user_events').all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe('item.created');
  });

  it('stores null payload when omitted', () => {
    const db = makeTestDb();
    logUserEvent(db, 'item.created');
    const row = db.query<EventRow, []>('SELECT * FROM user_events').get();
    expect(row?.payload).toBeNull();
  });

  it('stores JSON-serialized payload', () => {
    const db = makeTestDb();
    logUserEvent(db, 'item.created', { id: 'abc123' });
    const row = db.query<EventRow, []>('SELECT * FROM user_events').get();
    expect(row?.payload).toBe('{"id":"abc123"}');
  });

  it('inserts multiple rows independently', () => {
    const db = makeTestDb();
    logUserEvent(db, 'item.created', { id: 'a' });
    logUserEvent(db, 'item.deleted', { id: 'a' });
    const rows = db.query<EventRow, []>('SELECT * FROM user_events').all();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.type).toBe('item.created');
    expect(rows[1]?.type).toBe('item.deleted');
  });

  it('sets created_at as a recent timestamp', () => {
    const before = Date.now();
    const db = makeTestDb();
    logUserEvent(db, 'item.created');
    const after = Date.now();
    const row = db.query<EventRow, []>('SELECT * FROM user_events').get();
    expect(row?.created_at).toBeGreaterThanOrEqual(before);
    expect(row?.created_at).toBeLessThanOrEqual(after);
  });
});
