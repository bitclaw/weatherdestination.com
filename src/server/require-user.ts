import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import { users } from '@/lib/db/schema';
import type { GetSessionFn } from '@/server/session-cache';
import { getCachedSession } from '@/server/session-cache';

export const requireUser = async (
  getHeaders: () => Headers = getRequestHeaders,
  testDb?: typeof import('@/lib/db')['db'],
  // Passed through to getCachedSession() so tests keep their existing DI
  // seam even though the cache is now shared with requireAdmin/bootstrap -
  // see session-cache.ts.
  getSession?: GetSessionFn
) => {
  const headers = getHeaders();
  const session = await getCachedSession(headers, getSession);
  if (!session?.user) return null;

  // Re-read from DB for mutable state the session cookie may not reflect.
  // better-auth's session cookie cache (5-min TTL) means deletion-pending
  // and banned status can be stale in the session object even though
  // better-auth already deletes DB session rows on ban (routes.mjs) - the
  // cookie cache can still validate client-side during that window.
  // bootstrap.ts has its own explicit check for a nicer client-facing error;
  // this is the backstop for every other server function.
  //
  // Deliberately NOT checking hasAccess here: it's a billing-plan flag
  // ("gate Pro features on this", schema.ts), false by default for every
  // free-tier user and every signup before their first payment. Gating
  // requireUser() on it would treat the entire free tier as unauthenticated
  // across all 25+ features that call requireUser() first. Plan-based
  // feature gating belongs in UpgradeGate / checkEntitlement, not here.
  const db = testDb ?? (await import('@/lib/db')).db;
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { deletionPendingAt: true, banned: true }
  });
  if (dbUser?.deletionPendingAt || dbUser?.banned) return null;

  return session.user;
};
