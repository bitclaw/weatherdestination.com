# Feature Requests

Shared voting board at `/dashboard/feature-requests`. Any authenticated user
can submit a request and vote on others' requests; admins triage status,
priority, and category.

## What it does

- Any user creates a request with a title, description, and category
- Any user votes (one vote per user per request, enforced by a unique DB
  index, not just app logic , see `feature_request_votes_unique` in
  `src/lib/db/schema.ts`)
- The list is ordered by vote count (most-voted first), same for every
  viewer , this is the "shared" part; it replaced an earlier per-user-SQLite
  version where each user only saw their own private list
- Status (`submitted`, `planned`, `in_progress`, `shipped`, `declined`),
  priority, and category are triage decisions, editable only by admins via
  `updateFeatureRequestFn` (`requireAdmin()`-gated) , not by the original
  submitter after posting
- Plan-limited creation via `checkEntitlement` (`maxFeatureRequests`),
  counted per-user across the shared board (`countFeatureRequestsByUser`)

## Data model

Shared Drizzle DB (`meta.db`), not per-user SQLite , see `src/lib/db/schema.ts`:

- `featureRequests`: one row per request, `userId` FK to `users` (cascades
  on account deletion)
- `featureRequestVotes`: one row per (request, voter) pair, unique index on
  `(featureRequestId, userId)` makes double-voting a DB-level impossibility,
  cascades on either the request or the voter's user row being deleted

The vote-toggle write (`toggleFeatureRequestVote` in
`feature-requests.server.ts`) uses a **synchronous** `db.transaction()`
callback , see CLAUDE.md's "Shared-DB Transactions Must Use Sync Callbacks"
rule. An async callback here would let two concurrent toggles from the same
user both read "no vote yet" and both attempt an insert, tripping the unique
constraint as a raw DB error instead of behaving like a clean toggle.

## Key files

```
src/features/feature-requests/
├── index.ts                              -- barrel
├── feature-requests.constants.ts        -- Zod schemas, types, status/priority/category enums
├── server/
│   ├── feature-requests.server.ts       -- shared-DB read/write helpers, including vote toggle
│   ├── feature-requests.queries.ts      -- list (with per-viewer vote state)
│   ├── feature-requests.mutations.ts    -- create (any user), update/delete (admin), toggle vote (any user)
│   └── feature-requests-crud.test.ts
└── components/
    ├── feature-requests-table.tsx
    ├── feature-requests-columns.tsx     -- vote button/count column; triage actions column hidden for non-admins
    └── feature-requests-mutate-drawer.tsx  -- status/priority fields only shown when editing (admin-only path)
```

Route: `src/routes/_app.dashboard.feature-requests.index.tsx`. Reads
`isAdmin` via `useQuery(bootstrapQueryOptions)` (reactive), not route
context , see CLAUDE.md's "Route context is NOT reactive" note.

## Usage

```ts
import {
  featureRequestsQueryOptions,
  createFeatureRequestFn,
  updateFeatureRequestFn,
  deleteFeatureRequestFn,
  toggleFeatureRequestVoteFn,
  FeatureRequestsTable
} from '@/features/feature-requests';
```

## Customizing

To add request statuses (e.g. a new stage between `planned` and `in_progress`), extend `FEATURE_REQUEST_STATUSES` in `feature-requests.constants.ts`. Status badges render from the enum automatically.

## Migration note

The old per-user `feature_requests` table (created by a
`src/lib/db/migrations/*.ts` per-user migration) is left in place and
unused , per CLAUDE.md, a shipped migration's id must never be
removed/rewritten once deployed. The feature simply reads/writes the new
shared-DB tables above going forward; any pre-existing per-user rows from
before this change are orphaned, not migrated (there's no cross-user
identity to merge them into a shared board's vote model).
