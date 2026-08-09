# Notifications

In-app notification system. Notifications are stored in per-user SQLite and surfaced via a bell icon in the dashboard header.

## Architecture

- Stored in `notifications` table (per-user SQLite, migration `20260608_000600_add_notifications.ts`)
- Created via `notify()` helper , call it from any mutation after a write
- Read status tracked with a `read` integer column (0/1)

## Key files

| File | Purpose |
|------|---------|
| `src/lib/db/notify.ts` | `notify()` helper , creates a notification row |
| `src/features/notifications/server/notifications.queries.ts` | `listNotificationsFn` |
| `src/features/notifications/server/notifications.mutations.ts` | `markReadFn`, `markAllReadFn` |
| `src/features/notifications/server/notifications.server.ts` | DB operations |
| `src/features/notifications/index.ts` | Public barrel |

## Server functions

| Function | Method | Description |
|----------|--------|-------------|
| `listNotificationsFn` | GET | All notifications for current user |
| `markReadFn` | POST | Mark single notification read |
| `markAllReadFn` | POST | Mark all notifications read |

## Creating a notification

Import `notify` directly from `@/lib/db/notify` (not via barrel , server-only). Call inside `withWriteLock` after a successful write:

```ts
import { notify } from '@/lib/db/notify';

return withWriteLock(user.id, () => {
  const db = getUserDb(user.id);
  const result = createSomething(db, data);
  if (!result.ok) return result;

  logUserEvent(db, 'something.created', { id: result.data.id });
  notify(db, {
    title: 'Widget created',
    href: `/dashboard/widgets/${result.data.id}`
  });
  return result;
});
```

`notify()` signature:

```ts
notify(db: Database, input: {
  title: string;
  body?: string;
  href?: string;
})
```

`href` makes the notification clickable. `body` adds a subtitle line.

## Notes

- Notes feature (`src/features/notes`) is the reference implementation showing notify() + logUserEvent together.
- Not all features need notifications , use it when the action is async, delayed, or warrants persistent acknowledgment.
- There is no push/real-time delivery. Notifications are polled via `listNotificationsFn`.
