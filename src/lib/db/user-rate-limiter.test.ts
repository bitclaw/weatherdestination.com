import { describe, expect, it } from 'bun:test';
import { makeTestDb } from '@/test/db';
import { logUserEvent } from './user-events';
import { checkUserRateLimit } from './user-rate-limiter';

describe('checkUserRateLimit', () => {
  it('returns false in test env regardless of event count', () => {
    const db = makeTestDb();
    for (let i = 0; i < 10; i++) logUserEvent(db, 'item.created');
    expect(
      checkUserRateLimit(db, 'item.created', { windowMs: 60_000, max: 1 })
    ).toBe(false);
  });

  it('returns false when under the limit (production simulation)', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const db = makeTestDb();
      logUserEvent(db, 'item.created');
      logUserEvent(db, 'item.created');
      expect(
        checkUserRateLimit(db, 'item.created', { windowMs: 60_000, max: 5 })
      ).toBe(false);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('returns true when at the limit', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const db = makeTestDb();
      for (let i = 0; i < 5; i++) logUserEvent(db, 'item.created');
      expect(
        checkUserRateLimit(db, 'item.created', { windowMs: 60_000, max: 5 })
      ).toBe(true);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('ignores events outside the time window', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const db = makeTestDb();
      const old = Date.now() - 120_000;
      db.run(
        'INSERT INTO user_events (id, type, payload, created_at) VALUES (?, ?, NULL, ?)',
        ['old-id-1', 'item.created', old]
      );
      db.run(
        'INSERT INTO user_events (id, type, payload, created_at) VALUES (?, ?, NULL, ?)',
        ['old-id-2', 'item.created', old]
      );
      db.run(
        'INSERT INTO user_events (id, type, payload, created_at) VALUES (?, ?, NULL, ?)',
        ['old-id-3', 'item.created', old]
      );
      expect(
        checkUserRateLimit(db, 'item.created', { windowMs: 60_000, max: 3 })
      ).toBe(false);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('counts an event at exactly the window boundary (inclusive >=)', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const db = makeTestDb();
      const windowMs = 60_000;
      // Inserted at exactly now - windowMs; the query uses >=, so this event
      // must still count. A regression to > would silently under-count at the
      // edge. Generous slack (100ms) keeps the timestamp inside the window even
      // if GC or scheduler delay elapses between insert and check.
      db.run(
        'INSERT INTO user_events (id, type, payload, created_at) VALUES (?, ?, NULL, ?)',
        ['boundary-id', 'item.created', Date.now() - windowMs + 100]
      );
      expect(checkUserRateLimit(db, 'item.created', { windowMs, max: 1 })).toBe(
        true
      );
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('only counts the specified event type', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const db = makeTestDb();
      for (let i = 0; i < 5; i++) logUserEvent(db, 'item.deleted');
      expect(
        checkUserRateLimit(db, 'item.created', { windowMs: 60_000, max: 3 })
      ).toBe(false);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
