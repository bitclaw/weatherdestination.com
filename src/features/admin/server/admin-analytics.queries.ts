import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { ERROR_CODES } from '@/lib/constants';
import { db as sharedDb } from '@/lib/db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireAdmin } from '@/server/require-admin';
import { queryAdminAnalytics } from './admin-analytics.server';

const queryLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

export const getAdminAnalyticsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const adminResult = await requireAdmin();
    if (!adminResult.ok) return adminResult;
    if (queryLimiter.check(adminResult.data.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );
    return ok(await queryAdminAnalytics(sharedDb));
  }
);
