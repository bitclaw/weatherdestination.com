import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { setSetting } from '@/lib/db/settings-helpers.server';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import { MARKETING_EMAILS_KEY } from './notification-preferences.queries';

// User-id-keyed, checked after requireUser(): a shared NAT/proxy shouldn't
// let one user's requests count against another's budget.
const notificationPreferencesLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30
});

export const updateNotificationPreferencesFn = createServerFn({
  method: 'POST'
})
  .validator(z.object({ marketingEmails: z.boolean() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (notificationPreferencesLimiter.check(user.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      setSetting(db, MARKETING_EMAILS_KEY, data.marketingEmails ? '1' : '0');
      return ok(undefined);
    });
  });
