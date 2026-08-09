import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { subscriptions, users } from '@/lib/db/schema';
import { getUserDb } from '@/lib/db/user-db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import { getCachedSession } from '@/server/session-cache';
import { dumpUserDbTables } from './account.server';

// Two tiers, same reasoning as admin.mutations.ts's requireRateLimitedAdmin:
// exportLimiter gates by IP before requireUser() runs so an unauthenticated
// caller can't force a session lookup. userExportLimiter gates by the
// authenticated user's id after requireUser() succeeds, so users behind a
// shared NAT/proxy don't share one IP-keyed budget.
const exportLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
const userExportLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export const exportMyDataFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (exportLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (userExportLimiter.check(user.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');

    // Block a full data export while an admin is impersonating - same
    // rationale as deleteMyAccountFn's identical check.
    const session = await getCachedSession(getRequestHeaders());
    const impersonatedBy = (
      session?.session as { impersonatedBy?: string } | undefined
    )?.impersonatedBy;
    if (impersonatedBy) {
      return err(
        ERROR_CODES.FORBIDDEN,
        'Not available while impersonating another user'
      );
    }

    const [dbUser, sub] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, user.id) }),
      db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, user.id)
      })
    ]);

    const userDb = getUserDb(user.id);
    const userData = dumpUserDbTables(userDb);

    return ok({
      exported_at: new Date().toISOString(),
      profile: {
        name: dbUser?.name,
        email: dbUser?.email,
        createdAt: dbUser?.createdAt
      },
      subscription: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd
          }
        : null,
      data: userData
    });
  }
);
