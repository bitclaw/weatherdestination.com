import { err } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireAdmin } from '@/server/require-admin';
import { removeFlag, upsertFlag } from './feature-flags.server';

// Two tiers, same reasoning as admin.mutations.ts's requireRateLimitedAdmin:
// IP-keyed before requireAdmin() runs, admin-id-keyed after, so a shared
// NAT/proxy can't let one admin exhaust another's budget.
const flagsAdminLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
const flagsAdminUserLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

const flagNameSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'Must start with a letter, contain only lowercase letters, numbers, and underscores'
  );

export const setFeatureFlagFn = createServerFn({ method: 'POST' })
  .validator(z.object({ flag: flagNameSchema, enabled: z.boolean() }))
  .handler(async ({ data }) => {
    if (flagsAdminLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const adminResult = await requireAdmin();
    if (!adminResult.ok) return adminResult;
    if (flagsAdminUserLimiter.check(adminResult.data.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    return upsertFlag(db, data.flag, data.enabled);
  });

export const deleteFeatureFlagFn = createServerFn({ method: 'POST' })
  .validator(z.object({ flag: flagNameSchema }))
  .handler(async ({ data }) => {
    if (flagsAdminLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const adminResult = await requireAdmin();
    if (!adminResult.ok) return adminResult;
    if (flagsAdminUserLimiter.check(adminResult.data.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    return removeFlag(db, data.flag);
  });
