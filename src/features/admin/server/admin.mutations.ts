import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '@/config';
import { ERROR_CODES } from '@/lib/constants';
import { db as sharedDb } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import {
  createDeletionJob,
  runDeletionJob
} from '@/lib/operations/account-deletion.server';
import { createRateLimiter } from '@/server/rate-limit';
import { requireAdmin } from '@/server/require-admin';
import {
  isSelfTarget,
  recordImpersonationStart,
  setUserAccess
} from './admin.server';

// Two tiers: adminLimiter gates by IP before requireAdmin() runs, so an
// unauthenticated caller can't force a session lookup (and a possible
// auto-promote write) on every request. adminUserLimiter gates by the
// authenticated admin's user id after requireAdmin() succeeds, so admins
// behind a shared NAT/VPN don't share one IP-keyed budget, and a failed IP
// extraction (getClientIP() -> null -> 'unknown') can't collapse every admin
// into one global bucket , each admin still has their own budget from here.
const adminLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  // Pre-auth gate: a failed IP extraction must not collapse every caller
  // into the shared 'unknown' bucket here, since adminUserLimiter below
  // hasn't run yet to give each real admin their own budget.
  failClosedOnUnknownIp: true
});
const adminUserLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

const requireRateLimitedAdmin = async () => {
  if (adminLimiter.check())
    return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
  const adminResult = await requireAdmin();
  if (!adminResult.ok) return adminResult;
  if (adminUserLimiter.check(adminResult.data.id))
    return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
  return adminResult;
};

// better-auth's default generateId() produces a 32-char alphanumeric string
// (createRandomStringGenerator('a-z', 'A-Z', '0-9')), not a UUID , see
// node_modules/@better-auth/core/src/utils/id.ts. z.string().uuid() would
// reject every real user ID; this regex matches the actual ID shape while
// still rejecting path traversal / injection strings (none of which are
// pure alphanumeric).
export const userIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9]+$/, 'Invalid user ID format');

export const adminToggleAccessFn = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: userIdSchema, hasAccess: z.boolean() }))
  .handler(async ({ data }) => {
    const adminResult = await requireRateLimitedAdmin();
    if (!adminResult.ok) return adminResult;
    await setUserAccess(sharedDb, data.userId, data.hasAccess);
    const { invalidateBootstrapCache } = await import(
      '@/server/functions/bootstrap-cache'
    );
    invalidateBootstrapCache(data.userId);
    return ok({ userId: data.userId, hasAccess: data.hasAccess });
  });

export const adminDeleteUserFn = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: userIdSchema }))
  .handler(async ({ data }) => {
    const adminResult = await requireRateLimitedAdmin();
    if (!adminResult.ok) return adminResult;
    if (isSelfTarget({ adminId: adminResult.data.id, targetId: data.userId })) {
      return err(
        ERROR_CODES.FORBIDDEN,
        'You cannot delete your own admin account. Ask another admin.'
      );
    }

    const sub = await sharedDb.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, data.userId)
    });

    try {
      const { id: jobId } = await createDeletionJob({
        userId: data.userId,
        stripeSubscriptionId: sub?.stripeSubscriptionId ?? null,
        stripeCustomerId: sub?.stripeCustomerId ?? null,
        initiatedBy: 'admin'
      });

      const completed = await runDeletionJob(jobId);
      if (!completed)
        return ok({
          deleted: false,
          jobId,
          message:
            'Deletion started but not yet complete. Reconciler will finish on next startup.'
        });

      return ok({ deleted: true });
    } catch (caught: unknown) {
      return err(
        ERROR_CODES.INTERNAL,
        caught instanceof Error ? caught.message : 'Failed to delete user'
      );
    }
  });

export const adminSetRoleFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      userId: userIdSchema,
      role: z.enum(['user', 'admin'])
    })
  )
  .handler(async ({ data }) => {
    const adminResult = await requireRateLimitedAdmin();
    if (!adminResult.ok) return adminResult;
    if (isSelfTarget({ adminId: adminResult.data.id, targetId: data.userId })) {
      return err(
        ERROR_CODES.FORBIDDEN,
        'You cannot change your own role. Ask another admin.'
      );
    }
    const { auth } = await import('@/server/auth');
    const headers = getRequestHeaders();
    try {
      await auth.api.setRole({
        body: { userId: data.userId, role: data.role },
        headers
      });
    } catch (caught: unknown) {
      return err(
        ERROR_CODES.INTERNAL,
        caught instanceof Error ? caught.message : 'Failed to update role'
      );
    }
    return ok({ userId: data.userId, role: data.role });
  });

export const adminBanUserFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      userId: userIdSchema,
      banReason: z.string().max(500).optional(),
      banExpiresIn: z
        .number()
        .int()
        .min(1)
        .max(365 * 24 * 60 * 60)
        .optional()
    })
  )
  .handler(async ({ data }) => {
    const adminResult = await requireRateLimitedAdmin();
    if (!adminResult.ok) return adminResult;
    if (isSelfTarget({ adminId: adminResult.data.id, targetId: data.userId })) {
      return err(
        ERROR_CODES.FORBIDDEN,
        'You cannot ban your own admin account. Ask another admin.'
      );
    }
    const { auth } = await import('@/server/auth');
    const headers = getRequestHeaders();
    try {
      await auth.api.banUser({
        body: {
          userId: data.userId,
          banReason: data.banReason,
          banExpiresIn: data.banExpiresIn
        },
        headers
      });
    } catch (caught: unknown) {
      return err(
        ERROR_CODES.INTERNAL,
        caught instanceof Error ? caught.message : 'Failed to ban user'
      );
    }
    return ok({ userId: data.userId });
  });

export const adminUnbanUserFn = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: userIdSchema }))
  .handler(async ({ data }) => {
    const adminResult = await requireRateLimitedAdmin();
    if (!adminResult.ok) return adminResult;
    const { auth } = await import('@/server/auth');
    const headers = getRequestHeaders();
    try {
      await auth.api.unbanUser({ body: { userId: data.userId }, headers });
    } catch (caught: unknown) {
      return err(
        ERROR_CODES.INTERNAL,
        caught instanceof Error ? caught.message : 'Failed to unban user'
      );
    }
    return ok({ userId: data.userId });
  });

export const adminCreateUserFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().min(1).max(100),
      email: z
        .string()
        .email()
        .min(1)
        .max(254)
        .transform(e => e.toLowerCase()),
      role: z.enum(['user', 'admin']).default('user')
    })
  )
  .handler(async ({ data }) => {
    const adminResult = await requireRateLimitedAdmin();
    if (!adminResult.ok) return adminResult;
    const { auth } = await import('@/server/auth');
    const headers = getRequestHeaders();
    const { randomBytes } = await import('node:crypto');
    const tempPassword = randomBytes(32).toString('hex');
    try {
      const result = await auth.api.createUser({
        body: {
          name: data.name,
          email: data.email,
          role: data.role as 'user' | 'admin',
          password: tempPassword
        },
        headers
      });
      return ok({ userId: result.user.id });
    } catch (caught: unknown) {
      return err(
        ERROR_CODES.INTERNAL,
        caught instanceof Error ? caught.message : 'Failed to create user'
      );
    }
  });

export const adminInviteUserFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      email: z
        .string()
        .email()
        .min(1)
        .max(254)
        .transform(e => e.toLowerCase())
    })
  )
  .handler(async ({ data }) => {
    const adminResult = await requireRateLimitedAdmin();
    if (!adminResult.ok) return adminResult;
    const method = config.auth.verificationMethod;
    if (method !== 'magic-link' && method !== 'both') {
      return err(ERROR_CODES.INTERNAL, 'Magic link is not enabled in this app');
    }
    const { auth } = await import('@/server/auth');
    const headers = getRequestHeaders();
    try {
      await auth.api.signInMagicLink({
        body: { email: data.email, callbackURL: '/dashboard' },
        headers
      });
    } catch (caught: unknown) {
      return err(
        ERROR_CODES.INTERNAL,
        caught instanceof Error ? caught.message : 'Failed to send invite'
      );
    }
    return ok({ email: data.email });
  });

export const adminRevokeSessionsFn = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: userIdSchema }))
  .handler(async ({ data }) => {
    const adminResult = await requireRateLimitedAdmin();
    if (!adminResult.ok) return adminResult;
    if (isSelfTarget({ adminId: adminResult.data.id, targetId: data.userId })) {
      return err(
        ERROR_CODES.FORBIDDEN,
        'You cannot revoke your own sessions here , sign out normally instead.'
      );
    }
    const { auth } = await import('@/server/auth');
    const headers = getRequestHeaders();
    try {
      await auth.api.revokeUserSessions({
        body: { userId: data.userId },
        headers
      });
    } catch (caught: unknown) {
      return err(
        ERROR_CODES.INTERNAL,
        caught instanceof Error ? caught.message : 'Failed to revoke sessions'
      );
    }
    return ok({ userId: data.userId });
  });

export const adminListUserSessionsFn = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: userIdSchema }))
  .handler(async ({ data }) => {
    const adminResult = await requireRateLimitedAdmin();
    if (!adminResult.ok) return adminResult;
    const { auth } = await import('@/server/auth');
    const headers = getRequestHeaders();
    try {
      const result = await auth.api.listUserSessions({
        body: { userId: data.userId },
        headers
      });
      return ok(result.sessions ?? []);
    } catch (caught: unknown) {
      return err(
        ERROR_CODES.INTERNAL,
        caught instanceof Error ? caught.message : 'Failed to list sessions'
      );
    }
  });

// Rate-limited self-target pre-check only, NOT the audit trail , the actual
// session swap happens client-side via authClient.admin.impersonateUser (a
// server function response can't set the browser's session cookie, see
// docs/warpkit/features/admin.md), which the client can call directly
// without ever hitting this function first. The durable, non-bypassable
// audit write is a better-auth hooks.after matcher on /admin/impersonate-user
// itself (src/server/auth.ts), which fires regardless of whether this
// function ran. recordImpersonationStart's emit here is best-effort/early
// signal only.
export const adminImpersonateUserFn = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: userIdSchema }))
  .handler(async ({ data }) => {
    const adminResult = await requireRateLimitedAdmin();
    if (!adminResult.ok) return adminResult;
    if (isSelfTarget({ adminId: adminResult.data.id, targetId: data.userId })) {
      return err(ERROR_CODES.FORBIDDEN, 'You cannot impersonate yourself.');
    }
    await recordImpersonationStart(adminResult.data.id, data.userId);
    return ok({ success: true });
  });
