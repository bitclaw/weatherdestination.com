# Account

User-facing account lifecycle: durable account deletion and full data export. This is
a hub page , the deep documentation lives in the two linked docs below; this file only
maps the feature surface.

## What lives in `src/features/account/`

| Export | File | Purpose |
|--------|------|---------|
| `deleteMyAccountFn` | `server/account.mutations.ts` | POST. Kicks off the durable deletion state machine (Stripe cancel, user DB delete, shared-row delete) |
| `exportMyDataFn` | `server/account.queries.ts` | GET. Returns the user's complete data as JSON (rate-limited, 5/min) |
| `dumpUserDbTables` | `server/account.server.ts` | Pure helper: dumps every per-user table, redacting secret columns (`api_keys.key_hash`) via `REDACTED_COLUMNS` |

## Deep docs

- **Deletion state machine** , [durable-operations.md](./durable-operations.md):
  idempotent steps, lease-based retry, reconciler, why deletion is multi-step rather
  than a single transaction.
- **Data export + redaction** , [account-data-export.md](./account-data-export.md):
  export shape, what gets redacted and why key material never leaves the server even
  in the user's own export.

## Invariants worth knowing before touching this feature

- Deletion is durable: a crashed step resumes from `account_deletion_jobs`, never
  restarts from scratch. Do not add non-idempotent steps.
- `dumpUserDbTables` dumps **every** table dynamically (`sqlite_master`), so a new
  per-user table is exported automatically , if it contains secrets, add its columns
  to `REDACTED_COLUMNS` in `account.server.ts` in the same change.
