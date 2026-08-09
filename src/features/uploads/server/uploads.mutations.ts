import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { logUserEvent } from '@/lib/db/user-events';
import { checkUserRateLimit } from '@/lib/db/user-rate-limiter';
import type { PlanKey } from '@/lib/entitlements';
import { checkEntitlement } from '@/lib/entitlements';
import { requireUser } from '@/server/require-user';
import {
  addUploadSchema,
  MAX_FILE_SIZE_BYTES,
  MIME_TYPE_EXTENSIONS,
  uploadRequestSchema
} from '../uploads.constants';
import {
  addFile,
  deleteFileRow,
  getFileById,
  getS3Bucket,
  getS3Client,
  listFiles
} from './uploads.server';

export const getUploadUrlFn = createServerFn({ method: 'POST' })
  .validator(uploadRequestSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    const bucket = getS3Bucket();
    if (!bucket)
      return err(ERROR_CODES.STORAGE_NOT_CONFIGURED, 'S3 not configured');

    const ext = MIME_TYPE_EXTENSIONS[data.type];
    const { randomUUIDv7 } = await import('bun');
    const s3Key = `${user.id}/${randomUUIDv7()}${ext}`;

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
      columns: { plan: true }
    });
    const plan = (sub?.plan ?? 'free') as PlanKey;

    const gateResult = await withWriteLock(user.id, () => {
      const userDb = getUserDb(user.id);

      if (
        checkUserRateLimit(userDb, 'file.uploaded', {
          windowMs: 60_000,
          max: 10
        })
      ) {
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many uploads. Try again in a minute.'
        );
      }

      const count = listFiles(userDb).length;
      const { allowed, used, limit } = checkEntitlement(
        plan,
        'maxFileUploads',
        count
      );
      if (!allowed) {
        return err(
          ERROR_CODES.PLAN_LIMIT_EXCEEDED,
          `File limit reached: ${used}/${limit}. Upgrade to upload more files.`
        );
      }

      return ok(null);
    });

    if (!gateResult.ok) return gateResult;

    const { createPresignedPost } = await import('@aws-sdk/s3-presigned-post');
    const { url, fields } = await createPresignedPost(getS3Client(), {
      Bucket: bucket,
      Key: s3Key,
      Fields: { 'Content-Type': data.type },
      Conditions: [['content-length-range', 0, MAX_FILE_SIZE_BYTES]],
      // Short-lived: a presign is issued before any DB row exists, so
      // nothing here ties the presign to a confirmed upload
      // (addUploadToDbFn). A long-lived presign lets a client loop
      // getUploadUrlFn at the rate-limit ceiling and accumulate billable S3
      // storage no quota counts and no delete path can reach. 120s is
      // enough for a real upload to complete; combine with an S3 lifecycle
      // rule expiring unconfirmed objects for full coverage.
      Expires: 120
    });

    return ok({ url, fields, s3Key });
  });

export const addUploadToDbFn = createServerFn({ method: 'POST' })
  .validator(addUploadSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    if (!data.s3Key.startsWith(`${user.id}/`))
      return err(ERROR_CODES.VALIDATION_ERROR, 'Invalid upload key');

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
      columns: { plan: true }
    });
    const plan = (sub?.plan ?? 'free') as PlanKey;

    return withWriteLock(user.id, () => {
      const userDb = getUserDb(user.id);
      if (
        checkUserRateLimit(userDb, 'file.uploaded', {
          windowMs: 60_000,
          max: 10
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many uploads. Try again in a minute.'
        );

      // Re-check the quota at the point the row is actually created. The
      // presign gate in getUploadUrlFn counts no rows, so N presigns issued at
      // count = limit-1 would otherwise all insert here and blow past the cap.
      const count = listFiles(userDb).length;
      const { allowed, used, limit } = checkEntitlement(
        plan,
        'maxFileUploads',
        count
      );
      if (!allowed)
        return err(
          ERROR_CODES.PLAN_LIMIT_EXCEEDED,
          `File limit reached: ${used}/${limit}. Upgrade to upload more files.`
        );

      const result = addFile(userDb, {
        name: data.name,
        type: data.type,
        size: data.size,
        s3Key: data.s3Key
      });
      if (!result.ok) return result;
      logUserEvent(userDb, 'file.uploaded', { name: data.name });
      return result;
    });
  });

export const deleteUploadFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    const bucket = getS3Bucket();
    if (!bucket)
      return err(ERROR_CODES.STORAGE_NOT_CONFIGURED, 'S3 not configured');

    const result = await withWriteLock(user.id, () => {
      const userDb = getUserDb(user.id);
      if (
        checkUserRateLimit(userDb, 'file.deleted', {
          windowMs: 60_000,
          max: 10
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many deletions. Try again in a minute.'
        );
      const file = getFileById(userDb, data.id);
      if (!file) return err(ERROR_CODES.NOT_FOUND, 'File not found');

      const del = deleteFileRow(userDb, data.id);
      if (!del.ok) return del;

      logUserEvent(userDb, 'file.deleted', { id: data.id });
      return ok({ s3Key: file.s3_key });
    });

    if (result.ok) {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      getS3Client()
        .send(
          new DeleteObjectCommand({ Bucket: bucket, Key: result.data.s3Key })
        )
        .catch((e: unknown) => {
          // DB row is already gone, so this key is otherwise untraceable ,
          // log it so the orphaned object can be cleaned up manually.
          console.warn('S3 delete failed, object orphaned', {
            s3Key: result.data.s3Key,
            error: e instanceof Error ? e.message : String(e)
          });
        });
    }

    return result;
  });
