import { err, ok } from '@bitclaw/result';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import { ERROR_CODES } from '@/lib/constants';
import { users } from '@/lib/db/schema';
import { emit } from '@/server/events';
import type { GetSessionFn } from '@/server/session-cache';
import { getCachedSession } from '@/server/session-cache';

export const requireAdmin = async (
  getHeaders: () => Headers = getRequestHeaders,
  testDb?: typeof import('@/lib/db')['db'],
  // Passed through to getCachedSession() so tests keep their existing DI
  // seam even though the cache is now shared with requireUser/bootstrap -
  // see session-cache.ts.
  getSession?: GetSessionFn
) => {
  const headers = getHeaders();
  const session = await getCachedSession(headers, getSession);
  if (!session?.user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

  // An impersonated session must never itself exercise admin authority in
  // this app's own server functions, even if the impersonated user's email
  // happens to be in ADMIN_EMAILS - otherwise an admin impersonating a
  // freshly-added admin (before that user's role has been seeded/promoted)
  // inherits full admin rights through the impersonated session instead of
  // their own. better-auth's own /api/auth/admin/* routes are a separate
  // surface this check doesn't cover.
  //
  // impersonatedBy is real at runtime (adminPlugin's session schema
  // extension, node_modules/better-auth/dist/plugins/admin/types.d.mts) but
  // not threaded through auth.api.getSession()'s inferred return type here -
  // a known better-auth typing gap, not a made-up field. Cast narrowly
  // rather than widening Session everywhere.
  const impersonatedBy = (
    session.session as { impersonatedBy?: string | null } | undefined
  )?.impersonatedBy;
  if (impersonatedBy) {
    return err(ERROR_CODES.FORBIDDEN, 'Not available during impersonation');
  }

  // requireUser() has this same check; requireAdmin() and requireUser() now
  // share one cached session lookup (session-cache.ts) but still each need
  // their own DB re-read here - otherwise an admin's own account
  // mid-deletion keeps full admin powers (impersonate, ban, etc.) until the
  // row is actually purged.
  const db = testDb ?? (await import('@/lib/db')).db;
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { deletionPendingAt: true, banned: true, role: true }
  });
  if (dbUser?.deletionPendingAt || dbUser?.banned) {
    return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  if (!adminEmails.includes(session.user.email)) {
    return err(ERROR_CODES.FORBIDDEN, 'Admin access required');
  }

  // Auto-promote ADMIN_EMAILS users to role='admin' on first admin access.
  // Reads dbUser.role (fresh, from the query above) rather than
  // session.user.role, which comes from better-auth's 5-minute cookie
  // cache and would keep re-triggering this write/emit for up to 5 minutes
  // after the promotion actually lands.
  if (dbUser?.role !== 'admin') {
    await db
      .update(users)
      .set({ role: 'admin', updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
    await emit('admin.auto-promoted', {
      userId: session.user.id,
      email: session.user.email
    });
    // Dynamic import: @/lib/logger pulls in pino (node:os) and is outside
    // Vite's import-protection globs. A top-level import + module-scope
    // createLogger() call here is the exact pattern that leaked pino into
    // the client bundle from onboarding.ts.
    const { createLogger } = await import('@/lib/logger');
    createLogger({ module: 'require-admin' }).info(
      { userId: session.user.id, email: session.user.email },
      'auto-promoted'
    );
  }

  return ok(session.user);
};
