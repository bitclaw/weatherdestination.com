import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { db as sharedDb } from '@/lib/db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireAdmin } from '@/server/require-admin';
import { userIdSchema } from './admin.mutations';
import { queryAdminUserById, queryAdminUsers } from './admin.server';

const queryLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

const adminUsersInputSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  status: z.array(z.enum(['active', 'invited', 'banned'])).optional(),
  role: z.array(z.enum(['user', 'admin'])).optional(),
  plan: z.array(z.string()).optional()
});

// IP limiter intentionally omitted here , requireAdmin()'s session lookup is
// already the rate bottleneck for admin-only endpoints. The per-user limiter
// below guards against an already-authenticated admin hammering this query.
export const getAdminUsersFn = createServerFn({ method: 'GET' })
  .validator(adminUsersInputSchema)
  .handler(async ({ data }) => {
    const adminResult = await requireAdmin();
    if (!adminResult.ok) return adminResult;
    if (queryLimiter.check(adminResult.data.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );
    const page = await queryAdminUsers(sharedDb, {
      limit: data.pageSize,
      offset: data.page * data.pageSize,
      filter: {
        search: data.search,
        status: data.status,
        role: data.role,
        plan: data.plan
      }
    });
    return ok(page);
  });

export const getAdminUserDetailFn = createServerFn({ method: 'GET' })
  .validator(z.object({ userId: userIdSchema }))
  .handler(async ({ data }) => {
    const adminResult = await requireAdmin();
    if (!adminResult.ok) return adminResult;
    const user = await queryAdminUserById(sharedDb, data.userId);
    if (!user) return err(ERROR_CODES.NOT_FOUND, 'User not found');
    return ok(user);
  });
