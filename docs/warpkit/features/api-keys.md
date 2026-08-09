# API Keys

Per-user API key management. Keys use a `wk_` prefix and are stored hashed: only
`SHA-256(key)` plus a masked preview live in the DB. The raw key is returned once at
creation and is unrecoverable afterwards , all subsequent reads return the stored preview.

Hashing means a server-side compromise or a leaked backup exposes nothing usable at the
API surface. Per-user SQLite already limits cross-user blast radius, but it does nothing
against filesystem-level access , the hash does. The user's own data export also redacts
`key_hash` (see `dumpUserDbTables` in `src/features/account/server/account.server.ts`);
key material never leaves the server after creation.

## Architecture

- Keys stored in `api_keys` table (per-user SQLite; created by `20260608_000400_add_api_keys.ts`,
  rebuilt to hashed storage by `20260702_220044_hash_api_keys.ts`, which backfills existing rows)
- Columns: `key_hash` (SHA-256 hex, unique) + `key_preview` (masked, for the UI)
- Raw key returned only from `createApiKeyFn` response , never again after that
- UI always shows the stored preview: `wk_••••••••...abcd`
- `touchApiKey` updates `last_used_at` , call it from your auth middleware on each authenticated request
- Verify a presented key: `SELECT ... WHERE key_hash = ?` with `hashKey(presented)` from
  `api-keys.server.ts`

## Key files

| File | Purpose |
|------|---------|
| `src/features/api-keys/server/api-keys.server.ts` | Key generation, hashing, masking, DB operations |
| `src/features/api-keys/server/api-keys.mutations.ts` | Server functions: create, revoke, delete, touch |
| `src/features/api-keys/server/api-keys.queries.ts` | Server function: list (masked) |
| `src/features/api-keys/index.ts` | Public barrel |

## Server functions

| Function | Method | Description |
|----------|--------|-------------|
| `getApiKeysFn` | GET | List all keys (masked previews) |
| `createApiKeyFn` | POST | Create key, returns raw key once |
| `revokeApiKeyFn` | POST | Set status to `revoked` |
| `deleteApiKeyFn` | POST | Hard delete |
| `touchApiKeyFn` | POST | Update `last_used_at` (no write lock, no event log) |

## Usage

```ts
import { createApiKeyFn, getApiKeysFn, revokeApiKeyFn, touchApiKeyFn } from '@/features/api-keys';

// Create , show rawKey to user immediately, it won't be available again
const result = await createApiKeyFn({ data: { name: 'My app' } });
if (result.ok) {
  console.log(result.data.rawKey); // show once
}

// Track usage from your auth middleware
await touchApiKeyFn({ data: { id: keyId } });
```

## Key format

Keys are generated with `crypto.getRandomValues` and prefixed with `wk_`:

```
wk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

The prefix makes keys identifiable in logs and config files. Storage is
`SHA-256(key)` via `hashKey()` in `api-keys.server.ts`; the raw form exists only in the
`createApiKeyFn` response.

## Statuses

| Status | Meaning |
|--------|---------|
| `active` | Key works |
| `revoked` | Key rejected by middleware , row still exists for audit |

Revoked keys remain in the DB so the audit trail is preserved. Delete permanently removes the row.

## Plan limits

`createApiKeyFn` enforces `maxApiKeys` from `config.stripe.limits` via `checkEntitlement`
(defaults: free 3, solo 10, pro/team unlimited; `-1` = unlimited). Subscription plan is
read before `withWriteLock` (read-only gate); the key count is taken inside the lock.
Returns `ERROR_CODES.PLAN_LIMIT_EXCEEDED` when at cap.
