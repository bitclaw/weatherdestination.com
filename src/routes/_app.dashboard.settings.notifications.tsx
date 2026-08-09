import { createFileRoute } from '@tanstack/react-router';
import { notificationPreferencesQueryOptions } from '@/features/notification-preferences';
import type { AppRouteContext } from '@/lib/types';
import { NotificationsPage } from '@/pages/settings/notifications-page';

export const Route = createFileRoute('/_app/dashboard/settings/notifications')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    await ctx.queryClient.prefetchQuery(notificationPreferencesQueryOptions);
  },
  component: NotificationsPage
});
