import { createFileRoute } from '@tanstack/react-router';
import { sidebarPreferencesQueryOptions } from '@/features/sidebar-preferences';
import type { AppRouteContext } from '@/lib/types';
import { DisplayPage } from '@/pages/settings/display-page';

export const Route = createFileRoute('/_app/dashboard/settings/display')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    await ctx.queryClient.prefetchQuery(sidebarPreferencesQueryOptions);
  },
  component: DisplayPage
});
