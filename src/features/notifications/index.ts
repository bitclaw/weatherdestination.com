import { queryOptions } from '@tanstack/react-query';
import { notificationsQueryKey } from '@/lib/query-keys';
import { listNotificationsFn } from './server/notifications.queries';

export { NotificationBell } from './components/NotificationBell';
export { markAllReadFn, markReadFn } from './server/notifications.mutations';
export { listNotificationsFn } from './server/notifications.queries';

export const notificationsQueryOptions = queryOptions({
  queryKey: notificationsQueryKey(),
  queryFn: async () => {
    const result = await listNotificationsFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  refetchInterval: 30_000,
  staleTime: 30_000
});
