# Account & Data Export

Warpkit gives users full control over their data: GDPR-compliant export and permanent account deletion, both built in.

## Data export

`exportMyDataFn` returns a JSON snapshot of everything the user owns:

```ts
import { exportMyDataFn } from '@/features/account';

const result = await exportMyDataFn();
// result.data = {
//   exported_at: '2026-05-18T00:00:00.000Z',
//   profile: { name, email, createdAt },
//   subscription: { plan, status, currentPeriodEnd } | null,
//   data: {
//     example_items: [...],
//     notes: [...],
//     // all tables from the user's SQLite DB
//   }
// }
```

The export includes every table in the user's per-user SQLite (except the internal `_warpkit_migrations` table). As you add new feature tables, their **rows** appear in the export automatically , but any **secret-bearing column** does not get redacted automatically.

`dumpUserDbTables` (`src/features/account/server/account.server.ts`) checks each table against a hardcoded `REDACTED_COLUMNS` allowlist (currently only `api_keys: ['key', 'key_hash']`) and replaces matching column values with `'[redacted]'`. If you add a new per-user table with a secret/token/credential column, you must add it to `REDACTED_COLUMNS` in the same change , otherwise that column ships verbatim in the user's downloaded JSON and in the account-deletion confirmation email. `settings.value` is intentionally left out of `REDACTED_COLUMNS`: users need their own settings, including encrypted secrets, in their own export.

**What this means for GDPR:** Article 20 (data portability) is satisfied out of the box. Users can download everything in one click , but treat `REDACTED_COLUMNS` as a required checklist item whenever a new table can hold secret material.

## Account deletion

`deleteMyAccountFn` does a full teardown in order:

1. Cancel Stripe subscription (if active)
2. Delete Stripe customer record
3. Close the user's SQLite connection
4. Delete `data/users/<userId>/` directory recursively
5. Delete the user row from the shared DB (cascades to sessions and subscriptions)

```ts
import { deleteMyAccountFn } from '@/features/account';

const result = await deleteMyAccountFn();
```

Stripe cancellation and file deletion are non-fatal: if they fail, deletion continues. The user row deletion at step 5 is the authoritative cleanup.

## Where it lives

```
src/features/account/server/account.queries.ts    # exportMyDataFn
src/features/account/server/account.mutations.ts  # deleteMyAccountFn
```

Deletion is implemented as a durable state machine (`src/lib/operations/account-deletion.server.ts`). It persists each step to the shared DB so a server crash mid-deletion resumes on the next boot rather than leaving the user in a broken state. The four steps (cancel Stripe sub, delete Stripe customer, delete user DB file, delete shared user row) each have a completion timestamp; already-done steps are skipped on retry.

Both functions require an authenticated session. Unauthenticated calls return `UNAUTHORIZED`.
