import type { Database } from 'bun:sqlite';

export type Notification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read: number;
  created_at: number;
};

export const listNotifications = (db: Database): Notification[] =>
  db
    .query<Notification, []>(
      'SELECT * FROM notifications ORDER BY read ASC, created_at DESC LIMIT 50'
    )
    .all();

export const getUnreadCount = (db: Database): number =>
  db
    .query<{ count: number }, []>(
      'SELECT COUNT(*) AS count FROM notifications WHERE read = 0'
    )
    .get()?.count ?? 0;

export const markNotificationRead = (db: Database, id: string): void => {
  db.run('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
};

export const markAllNotificationsRead = (db: Database): void => {
  db.run('UPDATE notifications SET read = 1');
};
