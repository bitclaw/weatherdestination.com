import type { Database } from 'bun:sqlite';
import { randomUUIDv7 } from 'bun';

export type NotifyInput = { title: string; body?: string; href?: string };

// Must be a same-origin relative path (e.g. "/dashboard/notes/123") - the
// bell UI does `window.location.href = href` unconditionally on click, so
// anything else (javascript:, data:, an absolute external URL) would be a
// self-XSS-on-click vector for whatever future caller passes it.
const isSafeHref = (href: string): boolean =>
  href.startsWith('/') && !href.startsWith('//');

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 2000;

export const notify = (db: Database, input: NotifyInput): void => {
  const href = input.href && isSafeHref(input.href) ? input.href : null;
  const title = input.title.slice(0, MAX_TITLE_LENGTH);
  const body = input.body ? input.body.slice(0, MAX_BODY_LENGTH) : null;
  db.run(
    'INSERT INTO notifications (id, title, body, href, read, created_at) VALUES (?, ?, ?, ?, 0, ?)',
    [randomUUIDv7(), title, body, href, Date.now()]
  );
};
