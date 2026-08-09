import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { setSetting } from '@/lib/db/settings-helpers.server';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import { HIDDEN_SIDEBAR_ITEMS_KEY } from './sidebar-preferences.queries';

// User-id-keyed, checked after requireUser(): a shared NAT/proxy shouldn't
// let one user's requests count against another's budget.
const sidebarPreferencesLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30
});

export const updateSidebarPreferencesFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      // Bounded: these are nav item paths, not arbitrary user content - the
      // unbounded version let an authenticated user write an unbounded
      // payload into their own settings row, then have it loaded in full by
      // the data-export path.
      hiddenUrls: z
        .array(
          z
            .string()
            .max(200)
            .regex(/^\/[\w\-/]*$/)
        )
        .max(50)
    })
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (sidebarPreferencesLimiter.check(user.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      setSetting(db, HIDDEN_SIDEBAR_ITEMS_KEY, JSON.stringify(data.hiddenUrls));
      return ok(undefined);
    });
  });
