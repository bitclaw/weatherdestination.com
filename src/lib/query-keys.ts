// Query key factories , import from here in both queryOptions and invalidateQueries.
// No server function imports: safe to use in tests without triggering server fn side effects.
// query-options.ts re-exports these for backward compat.

export const bootstrapQueryKey = () => ['bootstrap'] as const;

export const apiKeysQueryKey = () => ['api-keys'] as const;

export const featureRequestsQueryKey = () => ['feature-requests'] as const;

export const auditLogQueryKey = () => ['audit-log'] as const;

export const conversationsQueryKey = () => ['conversations'] as const;
export const conversationMessagesQueryKey = (id: string) =>
  ['conversation-messages', id] as const;

export const featureFlagsQueryKey = () => ['feature-flags'] as const;
export const featureFlagQueryKey = (flag: string) =>
  ['feature-flags', flag] as const;

export const notificationsQueryKey = () => ['notifications'] as const;

export const subscriptionQueryKey = () => ['subscription'] as const;

export const notesQueryKey = () => ['notes'] as const;
export const noteDetailQueryKey = (id: string) => ['notes', id] as const;

export const uploadsQueryKey = () => ['uploads'] as const;

export const creditsQueryKey = () => ['credits'] as const;

export const citiesQueryKey = () => ['weather', 'cities'] as const;
export const cityComparisonQueryKey = (cityIds: string[]) =>
  ['weather', 'compare', [...cityIds].sort()] as const;

// Called with params for the specific paginated query (queryOptions);
// called with no args for invalidation, matching every paginated variant
// via TanStack Query's default key-prefix matching.
export const adminUsersQueryKey = (params?: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string[];
  role?: string[];
  plan?: string[];
}) =>
  params
    ? (['admin', 'users', params] as const)
    : (['admin', 'users'] as const);

export const adminUserDetailQueryKey = (userId: string) =>
  ['admin', 'users', 'detail', userId] as const;
export const adminAnalyticsQueryKey = () => ['admin', 'analytics'] as const;

export const adminJobStatsQueryKey = () => ['admin', 'jobs', 'stats'] as const;
export const adminJobsListPrefixKey = () => ['admin', 'jobs', 'list'] as const;
export const adminFailedJobsPrefixKey = () =>
  ['admin', 'jobs', 'failed'] as const;

export const adminJobsQueryKey = (
  status?: string,
  type?: string,
  limit?: number,
  offset?: number
) => ['admin', 'jobs', 'list', status, type, limit, offset] as const;
export const adminFailedJobsQueryKey = (
  type?: string,
  limit?: number,
  offset?: number
) => ['admin', 'jobs', 'failed', type, limit, offset] as const;
export const adminJobTypesQueryKey = () => ['admin', 'job-types'] as const;
export const adminSchedulesQueryKey = () => ['admin', 'schedules'] as const;

export const oneTimePurchaseQueryKey = () => ['one-time-purchase'] as const;

export const deviceSessionsQueryKey = () => ['device-sessions'] as const;

export const notificationPreferencesQueryKey = () =>
  ['notification-preferences'] as const;

export const sidebarPreferencesQueryKey = () =>
  ['sidebar-preferences'] as const;
