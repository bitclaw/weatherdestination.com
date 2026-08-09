import { describe, expect, it } from 'bun:test';
import { logUserEvent } from '@/lib/db/user-events';
import { makeTestDb } from '@/test/db';
import { listAuditEvents } from './audit-log.server';

describe('audit-log.server', () => {
  it('returns empty array for fresh db', () => {
    const db = makeTestDb();
    expect(listAuditEvents(db)).toHaveLength(0);
  });

  it('returns event with parsed payload', () => {
    const db = makeTestDb();
    logUserEvent(db, 'api_key.created', { id: 'abc123' });

    const events = listAuditEvents(db);
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev).toBeDefined();
    if (!ev) return;
    expect(ev.type).toBe('api_key.created');
    expect(ev.payload).toEqual({ id: 'abc123' });
    expect(ev.created_at).toBeGreaterThan(0);
  });

  it('returns event with null payload', () => {
    const db = makeTestDb();
    logUserEvent(db, 'task.deleted');

    const events = listAuditEvents(db);
    expect(events[0]?.payload).toBeNull();
  });

  it('returns events newest first', () => {
    const db = makeTestDb();
    logUserEvent(db, 'task.created', { id: 'first' });
    logUserEvent(db, 'task.updated', { id: 'second' });

    const events = listAuditEvents(db);
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe('task.updated');
    expect(events[1]?.type).toBe('task.created');
  });

  it('handles unknown event types without crashing', () => {
    const db = makeTestDb();
    logUserEvent(db, 'some.future.event', { data: 42 });

    const events = listAuditEvents(db);
    expect(events[0]?.type).toBe('some.future.event');
    expect(events[0]?.payload).toEqual({ data: 42 });
  });

  it('caps results at 500 events, newest first', () => {
    const db = makeTestDb();
    for (let i = 0; i < 505; i++) {
      logUserEvent(db, 'task.created', { i });
    }

    const events = listAuditEvents(db);
    expect(events).toHaveLength(500);
    expect(events[0]?.payload).toEqual({ i: 504 });
    expect(events[499]?.payload).toEqual({ i: 5 });
  });
});
