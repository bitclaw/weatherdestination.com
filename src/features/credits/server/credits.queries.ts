import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { requireFeatureFlagEnabled } from '@/features/feature-flags/server/feature-flags.server';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import { getCredits } from './credits.server';

const queryLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

export const getCreditsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'credits_enabled');
    if (!flag.ok) return flag;
    if (queryLimiter.check(user.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );
    return ok(await getCredits(db, user.id));
  }
);
