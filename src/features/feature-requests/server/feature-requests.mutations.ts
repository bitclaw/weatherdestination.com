import { err } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getCachedSubscription } from '@/features/billing/server/billing.server';
import {
  createFeatureRequestSchema,
  updateFeatureRequestSchema
} from '@/features/feature-requests/feature-requests.constants';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import type { PlanKey } from '@/lib/entitlements';
import { createRateLimiter } from '@/server/rate-limit';
import { requireAdmin } from '@/server/require-admin';
import { requireUser } from '@/server/require-user';
import {
  createFeatureRequest,
  deleteFeatureRequest,
  toggleFeatureRequestVote,
  updateFeatureRequest
} from './feature-requests.server';

// Shared-DB mutations, so these use the module-scope rate limiter pattern
// (createRateLimiter), not checkUserRateLimit (that's per-user-SQLite-only -
// see CLAUDE.md).
const createLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
const voteLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
const adminWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export const createFeatureRequestFn = createServerFn({ method: 'POST' })
  .validator(createFeatureRequestSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (createLimiter.check(user.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );

    const sub = await getCachedSubscription(user.id);
    const plan = (sub?.plan ?? 'free') as PlanKey;

    return createFeatureRequest(db, { userId: user.id, ...data }, plan);
  });

// Admin-only: status/priority/description/title triage. Regular users can
// only create + vote (see createFeatureRequestFn / toggleVoteFn) - a shared
// board's status/priority is a team decision, not something the submitter
// controls after posting.
export const updateFeatureRequestFn = createServerFn({ method: 'POST' })
  .validator(updateFeatureRequestSchema)
  .handler(async ({ data }) => {
    const adminResult = await requireAdmin();
    if (!adminResult.ok) return adminResult;
    if (adminWriteLimiter.check(adminResult.data.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );

    return updateFeatureRequest(db, data);
  });

export const deleteFeatureRequestFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const adminResult = await requireAdmin();
    if (!adminResult.ok) return adminResult;
    if (adminWriteLimiter.check(adminResult.data.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );

    return deleteFeatureRequest(db, data.id);
  });

export const toggleFeatureRequestVoteFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (voteLimiter.check(user.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );

    return toggleFeatureRequestVote(db, data.id, user.id);
  });
