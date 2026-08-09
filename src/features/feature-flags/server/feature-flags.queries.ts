import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import { getFlagEnabled, listFlags } from './feature-flags.server';

const flagLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

// Deliberately unauthenticated, unlike its sibling listFeatureFlagsFn below
// - CookieConsentBanner (mounted on every public page via __root.tsx) calls
// useFeatureFlag('cookie_consent_enabled') before any session exists, so
// this must be callable pre-auth. IP-rate-limited (120/min) so an anonymous
// caller can still only probe flag names, not enumerate them for free; a
// single boolean return per known flag name is a low-value oracle, not
// something worth an auth gate that would break the one real caller.
export const getFeatureFlagFn = createServerFn({ method: 'GET' })
  .validator(z.object({ flag: z.string().min(1).max(50) }))
  .handler(async ({ data }) => {
    if (flagLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    return ok(await getFlagEnabled(db, data.flag));
  });

export const listFeatureFlagsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (flagLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    return ok(await listFlags(db));
  }
);
