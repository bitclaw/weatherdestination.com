# Sidebar Preferences

Per-user setting for which dashboard sidebar navigation items are hidden. Stored in per-user SQLite encrypted settings, surfaced in Settings → Display.

## Architecture

- Uses `getSetting`/`setSetting` from `@/lib/db/settings-helpers.server` (per-user encrypted settings) — see [Per-user encrypted settings](../patterns/per-user-settings.md) for the underlying pattern.
- Stores a JSON array of URL path patterns (e.g. `["/dashboard/ai-chat"]`) under a single settings key, serialized with `JSON.stringify`/`JSON.parse` — not a dedicated table, since this is one small blob per user rather than rows that need querying individually.
- Default (no row): all sidebar items visible (`[]`)
- Dedicated query key in `query-keys.ts` for cache management
- Server fn: `getSidebarPreferencesFn` (GET), `updateSidebarPreferencesFn` (POST)

## Gate ordering

The write is a single-user settings blob replace — no read-then-write check on existing state, so it's a straightforward mutation inside `withWriteLock`, no pre-lock gate needed:

```ts
export const updateSidebarPreferencesFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ hiddenUrls: z.array(z.string()) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      setSetting(db, HIDDEN_SIDEBAR_ITEMS_KEY, JSON.stringify(data.hiddenUrls));
      return ok(undefined);
    });
  });
```

Reading (`getSidebarPreferencesFn`) parses the stored JSON, falling back to `[]` when no row exists.

## Tests

Covered in `src/features/sidebar-preferences/server/sidebar-preferences-crud.test.ts`.
