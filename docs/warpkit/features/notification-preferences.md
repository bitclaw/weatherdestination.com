# Notification Preferences

Per-user granular control over which notification types they receive. Stored in per-user SQLite encrypted settings, surfaced in Settings → Notifications.

## Architecture

- Uses `getSetting`/`setSetting` from `@/lib/db/settings-helpers.server` (per-user encrypted settings) — see [Per-user encrypted settings](../patterns/per-user-settings.md) for the underlying pattern.
- Default (no row): marketing emails opt-in
- Dedicated query key in `query-keys.ts` for cache management
- Server fn: `getNotificationPreferencesFn` (GET), `updateNotificationPreferencesFn` (POST)

```ts
export const updateNotificationPreferencesFn = createServerFn({
  method: 'POST'
})
  .inputValidator(z.object({ marketingEmails: z.boolean() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      setSetting(db, MARKETING_EMAILS_KEY, data.marketingEmails ? '1' : '0');
      return ok(undefined);
    });
  });
```

## Why encrypted settings, not the `notifications` table

This feature and the in-app notification bell (`docs/warpkit/features/notifications.md`) look similar but store fundamentally different things: the `notifications` table holds a growing list of discrete, timestamped bell items (append-only, one row per event, read/unread state per row). Notification preferences are a single small set of boolean/string toggles per user that get overwritten in place, never appended to or listed. There's no query pattern here that benefits from a table (no "list my preference changes," no per-row read state) — a settings key-value blob is the right shape, and reusing the same encrypted-settings helper as other per-user config (e.g. sidebar preferences, API keys) avoids introducing a second storage mechanism for what is structurally identical data.

## Comparison to Notifications

| Concern | Notifications | Notification Preferences |
|---------|--------------|------------------------|
| What it stores | In-app bell items | User preference toggles |
| Storage | `notifications` table (per-user SQLite) | Encrypted settings |
| Mutation side | Created by `notify()` helper | Updated by user in settings |
| Query layer | `notificationsQueryKey` | `notificationPreferencesQueryKey` |

## Default behavior

With no settings row present (new user, or a key never written), `getNotificationPreferencesFn` returns `marketingEmails: true` — new users are opted in to marketing email by default, matching the signup flow's assumption that a user who just created an account wants product updates until they explicitly opt out.

## Tests

Covered in `src/features/notification-preferences/server/notification-preferences-crud.test.ts`.
