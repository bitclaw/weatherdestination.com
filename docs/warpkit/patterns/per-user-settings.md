# Per-User Encrypted Settings

Typed get/set for per-user app settings stored in per-user SQLite, with optional encryption for sensitive values.

## Schema setup

Add a `settings` table to the user DB via a migration:

```ts
// src/lib/db/migrations/YYYYMMDD_HHMMSS_add_settings.ts
export const migration = {
  id: '0XX_add_settings',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
  }
};
```

## Reading and writing settings

Use helpers from `src/lib/db/settings-helpers.server.ts`:

```ts
import { getSetting, setSetting } from '@/lib/db/settings-helpers.server';

// Read (returns null if not set)
const apiKey = getSetting(db, 'openai_api_key');

// Write
setSetting(db, 'openai_api_key', 'sk-...');
```

## Encrypted settings

For sensitive values (API keys, tokens), use the encrypted variants:

```ts
import { getEncryptedSetting, setEncryptedSetting } from '@/lib/db/settings-helpers.server';

// Write (encrypts before storing)
setEncryptedSetting(db, 'openai_api_key', 'sk-...', process.env.SETTINGS_ENCRYPTION_KEY!);

// Read (decrypts on retrieval)
const key = getEncryptedSetting(db, 'openai_api_key', process.env.SETTINGS_ENCRYPTION_KEY!);
```

Set `SETTINGS_ENCRYPTION_KEY` in `.env` to a random 32-byte hex string:

```bash
openssl rand -hex 32
```

## In a mutation

```ts
return withWriteLock(user.id, () => {
  const db = getUserDb(user.id);
  setEncryptedSetting(db, 'openai_api_key', data.apiKey, process.env.SETTINGS_ENCRYPTION_KEY!);
  logUserEvent(db, 'settings.updated', { key: 'openai_api_key' });
  return ok({ success: true });
});
```

## Gate ordering note

Reading a setting to gate a mutation (e.g. "does API key exist?") is a read-only gate -- do it before `withWriteLock`. Writing a setting is a mutation -- do it inside the lock. See [Gate ordering](./gate-ordering.md).
