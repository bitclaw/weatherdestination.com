import { queryOptions } from '@tanstack/react-query';
import {
  adminAnalyticsQueryKey,
  adminUserDetailQueryKey,
  adminUsersQueryKey
} from '@/lib/query-keys';
import { getAdminUserDetailFn, getAdminUsersFn } from './server/admin.queries';
import { getAdminAnalyticsFn } from './server/admin-analytics.queries';

export {
  adminBanUserFn,
  adminCreateUserFn,
  adminDeleteUserFn,
  adminImpersonateUserFn,
  adminInviteUserFn,
  adminListUserSessionsFn,
  adminRevokeSessionsFn,
  adminSetRoleFn,
  adminToggleAccessFn,
  adminUnbanUserFn
} from './server/admin.mutations';
export type { AdminUser } from './server/admin.server';
export type { AdminAnalytics } from './server/admin-analytics.server';
export { getAdminAnalyticsFn, getAdminUserDetailFn, getAdminUsersFn };

export type AdminUsersParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: ('active' | 'invited' | 'banned')[];
  role?: ('user' | 'admin')[];
  plan?: string[];
};

export const adminUsersQueryOptions = (params: AdminUsersParams) =>
  queryOptions({
    queryKey: adminUsersQueryKey(params),
    queryFn: async () => {
      const result = await getAdminUsersFn({ data: params });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: 30_000
  });

export const adminUserDetailQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: adminUserDetailQueryKey(userId),
    queryFn: async () => {
      const result = await getAdminUserDetailFn({ data: { userId } });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: 30_000
  });

export const adminAnalyticsQueryOptions = queryOptions({
  queryKey: adminAnalyticsQueryKey(),
  queryFn: async () => {
    const result = await getAdminAnalyticsFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 30_000
});
