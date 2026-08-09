import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { subscriptions, users } from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makeSubscription, makeUser } from '@/test/fixtures';
import {
  isSelfTarget,
  queryAdminUserById,
  queryAdminUsers,
  setUserAccess
} from './admin.server';

// ---------------------------------------------------------------------------
// queryAdminUsers
// ---------------------------------------------------------------------------

const queryAll = (db: Parameters<typeof queryAdminUsers>[0]) =>
  queryAdminUsers(db, { limit: 50, offset: 0 });

describe('queryAdminUsers', () => {
  it('returns empty list when no users', async () => {
    const db = makeTestSharedDb();
    const result = await queryAll(db);
    expect(result.users).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('defaults plan to free when user has no subscription', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    const result = await queryAll(db);
    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.users[0]?.plan).toBe('free');
    expect(result.users[0]?.id).toBe(user.id);
  });

  it('returns correct plan from subscription row', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db
      .insert(subscriptions)
      .values(makeSubscription(user.id, { plan: 'pro', status: 'active' }));

    const result = await queryAll(db);
    expect(result.users[0]?.plan).toBe('pro');
    expect(result.users[0]?.hasAccess).toBe(true);
  });

  it('orders users by createdAt ASC', async () => {
    const db = makeTestSharedDb();
    const now = Date.now();
    const older = makeUser({ createdAt: new Date(now - 1000) });
    const newer = makeUser({ createdAt: new Date(now) });
    await db.insert(users).values(older);
    await db.insert(users).values(newer);

    const result = await queryAll(db);
    expect(result.users[0]?.id).toBe(older.id);
    expect(result.users[1]?.id).toBe(newer.id);
  });

  it('returns all required fields', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ name: 'Alice', email: 'alice@example.com' });
    await db.insert(users).values(user);

    const result = await queryAll(db);
    const row = result.users[0];
    expect(row?.id).toBe(user.id);
    expect(row?.email).toBe('alice@example.com');
    expect(row?.name).toBe('Alice');
    expect(typeof row?.hasAccess).toBe('boolean');
    expect(row?.createdAt).toBeInstanceOf(Date);
  });

  it('paginates with limit/offset', async () => {
    const db = makeTestSharedDb();
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await db.insert(users).values(makeUser({ createdAt: new Date(now + i) }));
    }

    const page1 = await queryAdminUsers(db, { limit: 2, offset: 0 });
    const page2 = await queryAdminUsers(db, { limit: 2, offset: 2 });
    expect(page1.total).toBe(5);
    expect(page1.users).toHaveLength(2);
    expect(page2.users).toHaveLength(2);
    expect(page1.users[0]?.id).not.toBe(page2.users[0]?.id);
  });

  it('filters by search across email and name', async () => {
    const db = makeTestSharedDb();
    await db
      .insert(users)
      .values(makeUser({ name: 'Alice', email: 'alice@example.com' }));
    await db
      .insert(users)
      .values(makeUser({ name: 'Bob', email: 'bob@example.com' }));

    const result = await queryAdminUsers(db, {
      limit: 50,
      offset: 0,
      filter: { search: 'alice' }
    });
    expect(result.total).toBe(1);
    expect(result.users[0]?.name).toBe('Alice');
  });

  it('filters by status, banned takes priority over unverified', async () => {
    const db = makeTestSharedDb();
    await db
      .insert(users)
      .values(makeUser({ banned: true, emailVerified: false }));

    const bannedResult = await queryAdminUsers(db, {
      limit: 50,
      offset: 0,
      filter: { status: ['banned'] }
    });
    const invitedResult = await queryAdminUsers(db, {
      limit: 50,
      offset: 0,
      filter: { status: ['invited'] }
    });
    expect(bannedResult.total).toBe(1);
    expect(invitedResult.total).toBe(0);
  });

  it('filters by plan, matching users with no subscription row as free', async () => {
    const db = makeTestSharedDb();
    const noSubUser = makeUser();
    const proUser = makeUser();
    await db.insert(users).values(noSubUser);
    await db.insert(users).values(proUser);
    await db
      .insert(subscriptions)
      .values(makeSubscription(proUser.id, { plan: 'pro', status: 'active' }));

    const freeResult = await queryAdminUsers(db, {
      limit: 50,
      offset: 0,
      filter: { plan: ['free'] }
    });
    expect(freeResult.total).toBe(1);
    expect(freeResult.users[0]?.id).toBe(noSubUser.id);
  });
});

describe('queryAdminUserById', () => {
  it('returns the matching user', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ name: 'Alice' });
    await db.insert(users).values(user);

    const result = await queryAdminUserById(db, user.id);
    expect(result?.id).toBe(user.id);
    expect(result?.name).toBe('Alice');
  });

  it('returns null when no user matches', async () => {
    const db = makeTestSharedDb();
    const result = await queryAdminUserById(db, 'nonexistent');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setUserAccess
// ---------------------------------------------------------------------------

describe('setUserAccess', () => {
  it('grants access', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: false });
    await db.insert(users).values(user);

    await setUserAccess(db, user.id, true);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(true);
  });

  it('revokes access', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);

    await setUserAccess(db, user.id, false);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
  });

  it('no-ops without throwing when user id does not exist', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: false });
    await db.insert(users).values(user);

    await setUserAccess(db, 'ghost-user-id', true);

    const untouched = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(untouched?.hasAccess).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSelfTarget
// ---------------------------------------------------------------------------
// Guards adminDeleteUserFn/adminBanUserFn/adminSetRoleFn/adminRevokeSessionsFn
// against an admin acting on their own account. A crafted call (or a stray
// DataTable click on their own row) previously let an admin delete or ban
// themselves with no recovery path if they were the last admin.

describe('isSelfTarget', () => {
  it('returns true when the caller targets their own id', () => {
    expect(isSelfTarget({ adminId: 'admin-1', targetId: 'admin-1' })).toBe(
      true
    );
  });

  it('returns false when the caller targets a different user', () => {
    expect(isSelfTarget({ adminId: 'admin-1', targetId: 'user-2' })).toBe(
      false
    );
  });
});
