import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { logUserEvent } from '@/lib/db/user-events';
import { checkUserRateLimit } from '@/lib/db/user-rate-limiter';
import { requireUser } from '@/server/require-user';
import {
  markAllNotificationsRead,
  markNotificationRead
} from './notifications.server';

export const markReadFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      if (
        checkUserRateLimit(db, 'notification.read', {
          windowMs: 60_000,
          max: 60
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many requests. Try again later.'
        );
      markNotificationRead(db, data.id);
      logUserEvent(db, 'notification.read', { id: data.id });
      return ok(null);
    });
  });

export const markAllReadFn = createServerFn({ method: 'POST' })
  .validator(z.object({}).strict())
  .handler(async () => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      if (
        checkUserRateLimit(db, 'notifications.all_read', {
          windowMs: 60_000,
          max: 10
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many requests. Try again later.'
        );
      markAllNotificationsRead(db);
      logUserEvent(db, 'notifications.all_read');
      return ok(null);
    });
  });
