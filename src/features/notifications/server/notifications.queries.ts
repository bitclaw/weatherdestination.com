import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { ERROR_CODES } from '@/lib/constants';
import { getUserDb } from '@/lib/db/user-db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import { listNotifications } from './notifications.server';

const queryLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

export const listNotificationsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (queryLimiter.check(user.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );

    const db = getUserDb(user.id);
    return ok(listNotifications(db));
  }
);
