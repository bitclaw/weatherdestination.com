import { err, ok } from '@bitclaw/result';
import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import type { PlanId } from '@/config';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { subscriptions, users } from '@/lib/db/schema';
import { bootstrapQueryKey } from '@/lib/query-keys';
import type { BootstrapPayload } from './bootstrap-cache';
import { bootstrapCache } from './bootstrap-cache';

export { invalidateBootstrapCache } from './bootstrap-cache';

const adminEmails = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

export const bootstrapQueryOptions = queryOptions({
  queryKey: bootstrapQueryKey(),
  queryFn: () => getBootstrapDataFn(),
  staleTime: Number.POSITIVE_INFINITY
});

export const getBootstrapDataFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { getCachedSession } = await import('@/server/session-cache');
    const headers = getRequestHeaders();
    const session = await getCachedSession(headers);

    if (!session?.user) {
      // Complete BootstrapPayload with explicit defaults, not a partial
      // shape - the authenticated branch below returns every field, and a
      // partial anonymous response forced every consumer to defensively
      // narrow the union (`result.data.isAdmin ?? false`, an `'isAdmin' in
      // bootstrap.data` check in one route) instead of trusting the type.
      return ok({
        user: null,
        hasAccess: false,
        plan: 'free' as const,
        isTrialing: false,
        trialEndsAt: null,
        isAdmin: false,
        onboardingComplete: false,
        credits: 0
      });
    }

    const user = session.user;

    const cached = bootstrapCache.get(user.id);
    if (cached !== undefined) return ok(cached);

    const [dbUser, sub] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: {
          hasAccess: true,
          onboardingComplete: true,
          deletionPendingAt: true,
          banned: true,
          credits: true
        }
      }),
      db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, user.id)
      })
    ]);

    if (dbUser?.deletionPendingAt) {
      return err(
        ERROR_CODES.ACCOUNT_DELETION_PENDING,
        'Account deletion in progress'
      );
    }
    // Mirrors requireUser()'s deletionPendingAt/banned check - without this,
    // a banned user still got the full authenticated shell (nav, admin link
    // if their email happens to be in ADMIN_EMAILS) for up to the
    // cookie-cache window; individual data fetches would fail via
    // requireUser() but the bootstrap-driven UI itself wouldn't reflect it.
    if (dbUser?.banned) {
      return err(ERROR_CODES.ACCOUNT_BANNED, 'This account has been banned');
    }

    const payload: BootstrapPayload = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image ?? null
      },
      hasAccess: dbUser?.hasAccess ?? false,
      plan: (sub?.plan ?? 'free') as 'free' | PlanId,
      isTrialing: sub?.status === 'trialing',
      trialEndsAt: sub?.trialEndsAt ?? null,
      isAdmin: adminEmails.includes(user.email),
      onboardingComplete: dbUser?.onboardingComplete ?? false,
      credits: dbUser?.credits ?? 0
    };

    bootstrapCache.set(user.id, payload);
    return ok(payload);
  }
);
