import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createApiKeySchema } from '@/features/api-keys/api-keys.constants';
import { requireFeatureFlagEnabled } from '@/features/feature-flags/server/feature-flags.server';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { logUserEvent } from '@/lib/db/user-events';
import { checkUserRateLimit } from '@/lib/db/user-rate-limiter';
import type { PlanKey } from '@/lib/entitlements';
import { checkEntitlement } from '@/lib/entitlements';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  revokeApiKey,
  touchApiKey
} from './api-keys.server';

export const createApiKeyFn = createServerFn({ method: 'POST' })
  .validator(createApiKeySchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'api_keys_enabled');
    if (!flag.ok) return flag;

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
      columns: { plan: true }
    });
    const plan = (sub?.plan ?? 'free') as PlanKey;

    return withWriteLock(user.id, () => {
      const userDb = getUserDb(user.id);
      if (
        checkUserRateLimit(userDb, 'api_key.created', {
          windowMs: 60_000,
          max: 10
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many requests. Try again in a minute.'
        );

      const count = listApiKeys(userDb).length;
      const { allowed, used, limit } = checkEntitlement(
        plan,
        'maxApiKeys',
        count
      );
      if (!allowed)
        return err(
          ERROR_CODES.PLAN_LIMIT_EXCEEDED,
          `API key limit reached: ${used}/${limit} on the ${plan} plan. Upgrade to create more.`
        );

      const result = createApiKey(userDb, data);
      if (!result.ok) return result;
      logUserEvent(userDb, 'api_key.created', { id: result.data.record.id });
      return result;
    });
  });

export const revokeApiKeyFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'api_keys_enabled');
    if (!flag.ok) return flag;

    return withWriteLock(user.id, () => {
      const userDb = getUserDb(user.id);
      if (
        checkUserRateLimit(userDb, 'api_key.revoked', {
          windowMs: 60_000,
          max: 10
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many requests. Try again in a minute.'
        );
      const result = revokeApiKey(userDb, data.id);
      if (!result.ok) return result;
      logUserEvent(userDb, 'api_key.revoked', { id: data.id });
      return result;
    });
  });

export const deleteApiKeyFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'api_keys_enabled');
    if (!flag.ok) return flag;

    return withWriteLock(user.id, () => {
      const userDb = getUserDb(user.id);
      if (
        checkUserRateLimit(userDb, 'api_key.deleted', {
          windowMs: 60_000,
          max: 10
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many requests. Try again in a minute.'
        );
      const result = deleteApiKey(userDb, data.id);
      if (!result.ok) return result;
      logUserEvent(userDb, 'api_key.deleted', { id: data.id });
      return result;
    });
  });

const touchApiKeyLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

// High-frequency , call from your auth middleware to track last usage.
// Does not require write lock for single-row UPDATE by PK.
export const touchApiKeyFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'api_keys_enabled');
    if (!flag.ok) return flag;
    // Keyed by user id, not the default IP fallback: this is an
    // authenticated per-user endpoint, and an IP-keyed limiter lets one
    // noisy user behind a shared NAT/proxy exhaust the budget for every
    // other unrelated user on that IP.
    if (touchApiKeyLimiter.check(user.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );

    const userDb = getUserDb(user.id);
    touchApiKey(userDb, data.id);
    return ok(true);
  });
