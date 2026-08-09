import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { getUserDb } from '@/lib/db/user-db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import {
  buildContentDispositionHeader,
  getFileById,
  getS3Bucket,
  getS3Client,
  listFiles
} from './uploads.server';

const queryLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

export const listUploadsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (queryLimiter.check(user.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );

    const db = getUserDb(user.id);
    return ok(listFiles(db));
  }
);

export const getDownloadUrlFn = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (queryLimiter.check(user.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );

    const bucket = getS3Bucket();
    if (!bucket)
      return err(ERROR_CODES.STORAGE_NOT_CONFIGURED, 'S3 not configured');

    const db = getUserDb(user.id);
    const file = getFileById(db, data.id);
    if (!file) return err(ERROR_CODES.NOT_FOUND, 'File not found');

    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const url = await getSignedUrl(
      getS3Client(),
      new GetObjectCommand({
        Bucket: bucket,
        Key: file.s3_key,
        ResponseContentDisposition: buildContentDispositionHeader(file.name)
      }),
      { expiresIn: 3600 }
    );

    return ok({ url });
  });
