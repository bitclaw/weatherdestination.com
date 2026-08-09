# Uploads

S3-backed file uploads using presigned POST (browser uploads directly to S3). File metadata is stored in per-user SQLite. Plan limits enforced via `checkEntitlement`.

## Architecture

- Browser uploads directly to S3 using a presigned POST URL (no file bytes through your server)
- Metadata (name, type, size, s3_key) stored in `files` table (per-user SQLite, migration `20260608_000800_add_files.ts`)
- Download via presigned GET URL generated on demand
- Gate ordering: S3 credential check and subscription lookup happen before `withWriteLock`

## Key files

| File | Purpose |
|------|---------|
| `src/features/uploads/server/uploads.mutations.ts` | `getUploadUrlFn`, `addUploadToDbFn`, `deleteUploadFn` |
| `src/features/uploads/server/uploads.queries.ts` | `listUploadsFn`, `getUploadUrlForDownloadFn` |
| `src/features/uploads/server/uploads.server.ts` | DB operations |
| `src/features/uploads/uploads.constants.ts` | `MAX_FILE_SIZE_BYTES`, schemas |

## Activation

Set these env vars , no code change needed:

```bash
AWS_S3_IAM_ACCESS_KEY=...
AWS_S3_IAM_SECRET_KEY=...
AWS_S3_FILES_BUCKET=my-bucket
AWS_S3_REGION=us-east-1
VITE_S3_FILES_BUCKET=my-bucket   # same value , exposes to client for feature detection
```

`config.uploads.enabled` is derived from `VITE_S3_FILES_BUCKET`. The files page shows a setup card when false.

## Upload flow

1. Client calls `getUploadUrlFn` with file name, type, size
2. Server checks S3 config, fetches subscription, enforces plan limit, returns presigned POST `{ url, fields, s3Key }`
3. Client POSTs directly to S3 using the URL and fields
4. On S3 success, client calls `addUploadToDbFn` to record metadata

```ts
import { getUploadUrlFn, addUploadToDbFn } from '@/features/uploads';

// Step 1: get presigned POST
const urlResult = await getUploadUrlFn({ data: { name, type, size } });
if (!urlResult.ok) return;

const { url, fields, s3Key } = urlResult.data;

// Step 2: upload directly to S3
const form = new FormData();
Object.entries(fields).forEach(([k, v]) => form.append(k, v));
form.append('file', file);
await fetch(url, { method: 'POST', body: form });

// Step 3: record metadata
await addUploadToDbFn({ data: { name, type, size, s3Key } });
```

## Gate ordering

See `docs/warpkit/patterns/gate-ordering.md` for the general rule (read-only gates before the
lock, mutable gates inside with a fresh read). This feature's specific application: S3
check and subscription lookup are read-only , they happen before `withWriteLock` to avoid
holding the lock during slow operations:

```
requireUser()
  check S3 bucket env var        (sync, before lock)
  createPresignedPost(...)       (async S3 call, before lock)
  fetch subscription from DB     (async read-only, before lock)
withWriteLock()
  checkUserRateLimit(...)
  checkEntitlement(plan, 'maxFileUploads', count)
  return ok({ url, fields, s3Key })
```

## Plan limits

Configured in `config.ts`:

```ts
limits: {
  free: { maxFileUploads: 10 },
  solo: { maxFileUploads: 100 },
  pro:  { maxFileUploads: -1 },   // -1 = unlimited
  team: { maxFileUploads: -1 }
}
```

## Deletion

`deleteUploadFn` removes the metadata row inside `withWriteLock`, then fires the S3 `DeleteObjectCommand` outside the lock (fire-and-forget, `.catch(() => {})`). S3 deletion failure does not affect the response.

## File size limit

`MAX_FILE_SIZE_BYTES` in `uploads.constants.ts`. Enforced via the presigned POST `content-length-range` condition , S3 rejects oversized uploads before they land.
