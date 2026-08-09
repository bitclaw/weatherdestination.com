import {
  and,
  count,
  eq,
  inArray,
  isNull,
  like,
  or,
  type SQL
} from 'drizzle-orm';
import type { PlanId } from '@/config';
import type { db as sharedDb } from '@/lib/db';
import { subscriptions, users } from '@/lib/db/schema';

type Db = typeof sharedDb;

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  hasAccess: boolean;
  role: string;
  banned: boolean;
  banReason: string | null;
  banExpires: Date | null;
  plan: 'free' | PlanId;
  createdAt: Date;
};

// Arrays: the faceted-filter UI is multi-select (e.g. Status: Active + Banned
// at once), so a single value per field isn't enough to match its contract.
export type AdminUsersFilter = {
  search?: string;
  status?: ('active' | 'invited' | 'banned')[];
  role?: ('user' | 'admin')[];
  plan?: string[];
};

export type AdminUsersPage = {
  users: AdminUser[];
  total: number;
};

// Mirrors deriveStatus() in users-columns.tsx (client-side status badge):
// banned takes priority over emailVerified, so 'invited' only ever means
// "not banned AND not verified". Keep these in sync - status filtering here
// would silently disagree with what the status column displays otherwise.
const singleStatusCondition = (
  status: 'active' | 'invited' | 'banned'
): SQL => {
  if (status === 'banned') return eq(users.banned, true);
  if (status === 'invited') {
    return and(eq(users.banned, false), eq(users.emailVerified, false))!;
  }
  return and(eq(users.banned, false), eq(users.emailVerified, true))!;
};

const statusCondition = (
  statuses: AdminUsersFilter['status']
): SQL | undefined => {
  if (!statuses || statuses.length === 0) return undefined;
  return or(...statuses.map(singleStatusCondition));
};

// A user with no subscriptions row (LEFT JOIN → null) is treated as 'free'
// everywhere else in this file, so filtering by plan='free' must also match
// the null case - inArray(subscriptions.plan, ['free']) alone would silently
// miss every user who's never had a subscription row created.
const planCondition = (plans: AdminUsersFilter['plan']): SQL | undefined => {
  if (!plans || plans.length === 0) return undefined;
  const withoutFree = plans.filter(p => p !== 'free');
  const conditions: SQL[] = [];
  if (plans.includes('free')) {
    conditions.push(
      or(eq(subscriptions.plan, 'free'), isNull(subscriptions.plan))!
    );
  }
  if (withoutFree.length > 0) {
    conditions.push(
      inArray(subscriptions.plan, withoutFree as ('solo' | 'pro' | 'team')[])
    );
  }
  return or(...conditions);
};

const adminUserSelect = {
  id: users.id,
  email: users.email,
  name: users.name,
  emailVerified: users.emailVerified,
  hasAccess: users.hasAccess,
  role: users.role,
  banned: users.banned,
  banReason: users.banReason,
  banExpires: users.banExpires,
  createdAt: users.createdAt,
  plan: subscriptions.plan
} as const;

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean | null;
  hasAccess: boolean;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  createdAt: Date;
  plan: string | null;
};

const toAdminUser = (r: AdminUserRow): AdminUser => ({
  id: r.id,
  email: r.email,
  name: r.name,
  emailVerified: r.emailVerified ?? false,
  hasAccess: r.hasAccess,
  plan: (r.plan ?? 'free') as 'free' | PlanId,
  role: r.role ?? 'user',
  banned: r.banned ?? false,
  banReason: r.banReason ?? null,
  banExpires: r.banExpires ?? null,
  createdAt: r.createdAt
});

// Previously had no LIMIT/pagination - fetched and joined the entire users
// table on every request regardless of what page the client-side table
// displayed, and the whole result set was re-fetched again on every
// filter/search keystroke since filtering was client-side too. Now takes
// real limit/offset/filter params pushed into the WHERE clause; the admin
// table (pages/index.tsx) switched to manualPagination/manualFiltering to
// match. Found via a real-hardware load test on runmist (a downstream
// fork of this template) - see its docs/runmist/performance.md.
export const queryAdminUsers = async (
  db: Db,
  {
    limit,
    offset,
    filter = {}
  }: { limit: number; offset: number; filter?: AdminUsersFilter }
): Promise<AdminUsersPage> => {
  const conditions = [
    statusCondition(filter.status),
    filter.role && filter.role.length > 0
      ? inArray(users.role, filter.role)
      : undefined,
    planCondition(filter.plan),
    filter.search
      ? or(
          like(users.email, `%${filter.search}%`),
          like(users.name, `%${filter.search}%`)
        )
      : undefined
  ].filter((c): c is SQL => c !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select(adminUserSelect)
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .where(where)
      .orderBy(users.createdAt)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .where(where)
  ]);
  const total = totalRows[0]?.total ?? 0;

  return { total, users: rows.map(toAdminUser) };
};

// Single-user lookup for the admin detail page (/dashboard/admin/$userId) -
// previously that page fetched the entire (unbounded) users list and did a
// client-side .find(u => u.id === userId), the same class of bug as
// queryAdminUsers' missing LIMIT, just on the detail page instead of the
// list page.
export const queryAdminUserById = async (
  db: Db,
  userId: string
): Promise<AdminUser | null> => {
  const [row] = await db
    .select(adminUserSelect)
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ? toAdminUser(row) : null;
};

export const setUserAccess = async (
  db: Db,
  userId: string,
  hasAccess: boolean
): Promise<void> => {
  await db
    .update(users)
    .set({ hasAccess, updatedAt: new Date() })
    .where(eq(users.id, userId));
};

export const recordImpersonationStart = async (
  adminUserId: string,
  targetUserId: string
): Promise<void> => {
  const { emit } = await import('@/server/events');
  await emit('admin.impersonation.started', { adminUserId, targetUserId });
};

// Guards destructive/state-changing admin actions (delete, ban, role change,
// session revocation) against being pointed at the calling admin's own
// account. Without this, an admin can delete or ban themselves with no
// recovery path if they were the last admin , requireAdmin() rejects the
// now-deleted/banned session on every subsequent request.
//
// Named params, not positional , the 4 call sites in admin.mutations.ts are
// the only place this ever runs and none of them are under test (calling a
// createServerFn-wrapped function directly isn't practical outside a real
// request context), so a silently-swapped (targetId, adminId) argument
// order would go uncaught. Named params turn that into a naming bug instead
// of a positional-transposition bug.
export const isSelfTarget = ({
  adminId,
  targetId
}: {
  adminId: string;
  targetId: string;
}): boolean => adminId === targetId;
