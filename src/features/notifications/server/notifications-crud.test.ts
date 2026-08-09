import { describe, expect, it } from 'bun:test';
import { notify } from '@/lib/db/notify';
import { makeTestDb } from '@/test/db';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from './notifications.server';

describe('notifications CRUD', () => {
  it('inserts and lists notifications unread-first', () => {
    const db = makeTestDb();
    notify(db, { title: 'First' });
    notify(db, { title: 'Second' });
    const first = listNotifications(db).at(0);
    if (!first) throw new Error('expected notification');
    markNotificationRead(db, first.id);

    const rows = listNotifications(db);
    expect(rows.at(0)?.read).toBe(0);
    expect(rows.at(-1)?.read).toBe(1);
  });

  it('stores title, body, href correctly', () => {
    const db = makeTestDb();
    notify(db, { title: 'Hello', body: 'World', href: '/dashboard' });

    const row = listNotifications(db).at(0);
    if (!row) throw new Error('expected notification');
    expect(row.title).toBe('Hello');
    expect(row.body).toBe('World');
    expect(row.href).toBe('/dashboard');
    expect(row.read).toBe(0);
  });

  it('marks one notification read', () => {
    const db = makeTestDb();
    notify(db, { title: 'A' });
    notify(db, { title: 'B' });

    const first = listNotifications(db).at(0);
    if (!first) throw new Error('expected notification');
    markNotificationRead(db, first.id);

    const updated = listNotifications(db).find(r => r.id === first.id);
    expect(updated?.read).toBe(1);
    expect(getUnreadCount(db)).toBe(1);
  });

  it('marks all notifications read', () => {
    const db = makeTestDb();
    notify(db, { title: 'A' });
    notify(db, { title: 'B' });
    notify(db, { title: 'C' });

    expect(getUnreadCount(db)).toBe(3);
    markAllNotificationsRead(db);
    expect(getUnreadCount(db)).toBe(0);
  });

  it('returns 0 unread count on empty DB', () => {
    const db = makeTestDb();
    expect(getUnreadCount(db)).toBe(0);
  });

  it('marking nonexistent notification is a no-op', () => {
    const db = makeTestDb();
    expect(() => markNotificationRead(db, 'ghost')).not.toThrow();
  });

  it('markAllRead on empty DB is a no-op', () => {
    const db = makeTestDb();
    expect(() => markAllNotificationsRead(db)).not.toThrow();
  });
});
