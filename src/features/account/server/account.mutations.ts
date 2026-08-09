import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import {
  createDeletionJob,
  runDeletionJob
} from '@/lib/operations/account-deletion.server';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import { getCachedSession } from '@/server/session-cache';

// Two tiers, same reasoning as admin.mutations.ts's requireRateLimitedAdmin:
// deleteLimiter gates by IP before requireUser() runs; userDeleteLimiter
// gates by the authenticated user's id after, so a shared NAT/proxy can't
// let one user exhaust another's budget.
const deleteLimiter = createRateLimiter({ windowMs: 60_000, max: 3 });
const userDeleteLimiter = createRateLimiter({ windowMs: 60_000, max: 3 });

export const deleteMyAccountFn = createServerFn({ method: 'POST' })
  .validator(z.object({}).strict())
  .handler(async () => {
    if (deleteLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (userDeleteLimiter.check(user.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');

    // requireUser() only returns session.user, not impersonatedBy - fetch
    // the cached session directly (same lookup requireUser() already paid
    // for, deduped) to block this irreversible action while an admin is
    // impersonating. Impersonation exists for support/debugging as the
    // target user, not to let an admin delete that user's account on their
    // behalf without the user's own action.
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

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });

    try {
      const { id: jobId } = await createDeletionJob({
        userId: user.id,
        stripeSubscriptionId: sub?.stripeSubscriptionId ?? null,
        stripeCustomerId: sub?.stripeCustomerId ?? null,
        initiatedBy: 'user'
      });

      const completed = await runDeletionJob(jobId);
      if (!completed)
        return err(
          ERROR_CODES.INTERNAL,
          'Account deletion started but did not complete. It will finish automatically. Contact support if it persists.'
        );

      return ok({ deleted: true });
    } catch (caught: unknown) {
      return err(
        ERROR_CODES.INTERNAL,
        caught instanceof Error
          ? caught.message
          : 'Failed to start account deletion'
      );
    }
  });
