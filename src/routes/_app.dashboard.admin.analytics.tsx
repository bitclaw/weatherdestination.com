import { createFileRoute } from '@tanstack/react-router';
import { adminAnalyticsQueryOptions } from '@/features/admin';
import type { AppRouteContext } from '@/lib/types';
import { AdminAnalyticsPage } from '@/pages/admin/analytics';

export const Route = createFileRoute('/_app/dashboard/admin/analytics')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    await ctx.queryClient.prefetchQuery(adminAnalyticsQueryOptions);
  },
  component: AdminAnalyticsPage
});
