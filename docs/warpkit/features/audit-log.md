# Audit Log

Read-only event viewer at `/dashboard/audit-log`. Shows the **current user their own** `user_events` rows written by `logUserEvent`. It is a per-user self-view, not an admin tool: events live in each user's own SQLite file, so there is no cross-user query to run.

## How events get there

Every authenticated mutation should call `logUserEvent` after a successful write:

```ts
import { logUserEvent } from '@/lib/db/user-events';

// Inside withWriteLock, after the write:
logUserEvent(db, 'item.created', { id });
```

`logUserEvent` appends a row to the `user_events` table in the per-user SQLite DB. The audit-log feature reads these rows back for the same user.

**Scope:** `logUserEvent` only applies to mutations using `getUserDb()`. Shared-DB mutations (billing, credits, admin operations) are not covered.

## Access

Any authenticated user can open the page; `getAuditLogFn` calls `requireUser()` and reads `getUserDb(user.id)`, so each user only ever sees their own events, sorted newest first, with event type, timestamp, and payload. An admin wanting another user's events would need direct access to that user's SQLite file; no cross-user UI exists by design.

**Files:**
- `src/features/audit-log/server/audit-log.queries.ts` -- fetches the current user's events (`requireUser`)
- `src/features/audit-log/components/` -- event table UI
- Route: `src/routes/_app.dashboard.audit-log.index.tsx`

## Per-user rate limiting integration

`checkUserRateLimit` counts `user_events` rows to enforce per-user rate limits. Writing to `user_events` via `logUserEvent` is what feeds that count. Both must happen inside `withWriteLock`. See [Rate limiting](../security/rate-limiting.md#per-user-db-backed-rate-limiting).
