import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';
import { randomUUIDv7 } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { ERROR_CODES } from '@/lib/constants';
import * as schema from '@/lib/db/schema';
import { users } from '@/lib/db/schema';
import { requireAdmin } from '@/server/require-admin';
import { requireUser } from '@/server/require-user';

// EXCEPTION to .claude/skills/testing/SKILL.md "What NOT to Test — Server
// functions directly": requireAdmin/requireUser are the one shared auth
// primitive every feature's server functions trust and none of them re-verify
// it (per convention, feature tests exercise *.server.ts logic, not the
// createServerFn wrapper). If these two gates are broken, every feature is
// broken the same way, so they get their own direct test here instead of
// being covered N times over in every feature's test suite. Ported from the
// equivalent runmist-warpkit fix (same gap found there during a cross-repo
// admin audit, 2026-07-02).
//
// requireUser/requireAdmin take optional (getHeaders, db, getSession) params
// with real defaults specifically so this file can inject a stub headers fn,
// an in-memory test DB, and a stub session getter directly, as ordinary
// arguments — no globalThis seam, no mock.module, no dependency on this file
// running alone in its own process. An earlier version of this file used
// both of those tricks for (getHeaders, db) and a bare `auth.api.getSession =
// mock(...)` property overwrite for the session; all three leaked
// process-wide across test files with no way to fully undo them once
// registered (`mock.restore()` reverts `spyOn()` mocks, not a bare property
// overwrite — the getSession overwrite stayed monkey-patched for every test
// file that ran afterward in the same bun:test process). DI removed the need
// for any of them (see .claude/skills/testing/SKILL.md, "Testing Outbound
// HTTP").

const testSqlite = new Database(':memory:');
testSqlite.run('PRAGMA foreign_keys = ON');
const testDb = drizzle(testSqlite, { schema });
migrate(testDb, { migrationsFolder: './drizzle' });

const testHeaders = () => new Headers();

const asUser = (userId: string | null, email?: string) => async () =>
  userId ? ({ user: { id: userId, email: email ?? '' } } as never) : null;

// impersonatedBy is real at runtime (better-auth's admin plugin session
// schema extension) but not part of the app's own Session type - see
// require-admin.ts's cast comment. Cast here too, matching asUser() above.
const asImpersonatedUser = (userId: string, email: string) => async () =>
  ({
    user: { id: userId, email },
    session: { impersonatedBy: 'some-admin-id' }
  }) as never;

const originalAdminEmails = process.env.ADMIN_EMAILS;

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe('requireUser', () => {
  it('returns null when there is no session', async () => {
    const user = await requireUser(testHeaders, testDb, asUser(null));
    expect(user).toBeNull();
  });

  it('returns the session user when authenticated', async () => {
    const userId = randomUUIDv7();
    await testDb.insert(users).values({
      id: userId,
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      hasAccess: false,
      onboardingComplete: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const user = await requireUser(testHeaders, testDb, asUser(userId));
    expect(user?.id).toBe(userId);
  });

  // hasAccess is a billing-plan flag ("gate Pro features on this"), false
  // by default for every free-tier user - requireUser must NOT gate on it,
  // or every unpaid user is locked out of the entire app. Pinning test for
  // a regression introduced and reverted the same day (2026-07-22).
  it('returns the session user when authenticated with no paid access', async () => {
    const userId = randomUUIDv7();
    await testDb.insert(users).values({
      id: userId,
      name: 'Free User',
      email: 'free@example.com',
      emailVerified: true,
      hasAccess: false,
      onboardingComplete: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const user = await requireUser(
      testHeaders,
      testDb,
      asUser(userId, 'free@example.com')
    );
    expect(user?.id).toBe(userId);
  });

  it('returns null when the account has a pending deletion', async () => {
    const userId = randomUUIDv7();
    await testDb.insert(users).values({
      id: userId,
      name: 'Deleting User',
      email: 'deleting@example.com',
      emailVerified: true,
      hasAccess: false,
      onboardingComplete: true,
      deletionPendingAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const user = await requireUser(
      testHeaders,
      testDb,
      asUser(userId, 'deleting@example.com')
    );
    expect(user).toBeNull();
  });

  it('returns null when the user is banned', async () => {
    const userId = randomUUIDv7();
    await testDb.insert(users).values({
      id: userId,
      name: 'Banned User',
      email: 'banned@example.com',
      emailVerified: true,
      hasAccess: false,
      banned: true,
      onboardingComplete: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const user = await requireUser(
      testHeaders,
      testDb,
      asUser(userId, 'banned@example.com')
    );
    expect(user).toBeNull();
  });

  it('returns user when authenticated and active', async () => {
    const userId = randomUUIDv7();
    await testDb.insert(users).values({
      id: userId,
      name: 'Active User',
      email: 'active@example.com',
      emailVerified: true,
      hasAccess: true,
      onboardingComplete: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const user = await requireUser(
      testHeaders,
      testDb,
      asUser(userId, 'active@example.com')
    );
    expect(user?.id).toBe(userId);
  });
});

describe('requireAdmin', () => {
  it('returns UNAUTHORIZED with no session', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    const result = await requireAdmin(testHeaders, testDb, asUser(null));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('returns FORBIDDEN when email is not in ADMIN_EMAILS', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    const userId = randomUUIDv7();
    await testDb.insert(users).values({
      id: userId,
      name: 'Regular User',
      email: 'regular@example.com',
      emailVerified: true,
      hasAccess: false,
      onboardingComplete: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const result = await requireAdmin(
      testHeaders,
      testDb,
      asUser(userId, 'regular@example.com')
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('returns ok and auto-promotes a user whose email is in ADMIN_EMAILS', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com, other@example.com';
    const userId = randomUUIDv7();
    await testDb.insert(users).values({
      id: userId,
      name: 'Admin User',
      email: 'admin@example.com',
      emailVerified: true,
      hasAccess: false,
      onboardingComplete: true,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const result = await requireAdmin(
      testHeaders,
      testDb,
      asUser(userId, 'admin@example.com')
    );
    expect(result.ok).toBe(true);

    const row = await testDb.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId)
    });
    expect(row?.role).toBe('admin');
  });

  it('returns UNAUTHORIZED when the admin account has a pending deletion', async () => {
    process.env.ADMIN_EMAILS = 'deleting-admin@example.com';
    const userId = randomUUIDv7();
    await testDb.insert(users).values({
      id: userId,
      name: 'Deleting Admin',
      email: 'deleting-admin@example.com',
      emailVerified: true,
      hasAccess: false,
      onboardingComplete: true,
      role: 'admin',
      deletionPendingAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const result = await requireAdmin(
      testHeaders,
      testDb,
      asUser(userId, 'deleting-admin@example.com')
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('returns FORBIDDEN for an impersonated session, even for an ADMIN_EMAILS user', async () => {
    process.env.ADMIN_EMAILS = 'impersonated-admin@example.com';
    const userId = randomUUIDv7();
    await testDb.insert(users).values({
      id: userId,
      name: 'Admin User',
      email: 'impersonated-admin@example.com',
      emailVerified: true,
      hasAccess: false,
      onboardingComplete: true,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const result = await requireAdmin(
      testHeaders,
      testDb,
      asImpersonatedUser(userId, 'impersonated-admin@example.com')
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ERROR_CODES.FORBIDDEN);
  });
});
