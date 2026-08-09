import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { invalidateBootstrapCache } from '@/server/functions/bootstrap-cache';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import { completeOnboarding } from './onboarding.server';

const schema = z.object({
  name: z.string().max(100).optional()
});

const onboardingLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export const completeOnboardingFn = createServerFn({ method: 'POST' })
  .validator(schema)
  .handler(async ({ data }) => {
    if (onboardingLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not signed in');

    try {
      await completeOnboarding(db, user.id, data.name);
      // Without this, the bootstrap TTLCache (10s) keeps serving
      // onboardingComplete: false and the dashboard bounces back here.
      invalidateBootstrapCache(user.id);
      return ok(true);
    } catch (e) {
      // Dynamic import: @/lib/logger pulls in pino (node:os) and is not
      // covered by Vite's import-protection globs, so a top-level import
      // here would leak into the client bundle via routes/onboarding.tsx.
      const { createLogger } = await import('@/lib/logger');
      createLogger({ module: 'onboarding' }).error(
        { err: e },
        'completeOnboarding: DB write failed'
      );
      return err(ERROR_CODES.INTERNAL, 'Failed to complete onboarding.');
    }
  });
