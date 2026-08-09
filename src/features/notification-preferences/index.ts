import { queryOptions } from '@tanstack/react-query';
import { notificationPreferencesQueryKey } from '@/lib/query-keys';
import { getNotificationPreferencesFn } from './server/notification-preferences.queries';

export const notificationPreferencesQueryOptions = queryOptions({
  queryKey: notificationPreferencesQueryKey(),
  queryFn: async () => {
    const result = await getNotificationPreferencesFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 30_000
});

export { updateNotificationPreferencesFn } from './server/notification-preferences.mutations';
