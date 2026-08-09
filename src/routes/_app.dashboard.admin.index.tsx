import { createFileRoute } from '@tanstack/react-router';
import { adminUsersQueryOptions } from '@/features/admin';
import { AdminPage } from '@/features/admin/pages';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/admin/')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    // Matches AdminPage's own default pagination state exactly, so this
    // prefetch is actually a cache hit on first render instead of wasted -
    // a mismatch here would prefetch a page nobody's about to look at.
    await ctx.queryClient.prefetchQuery(
      adminUsersQueryOptions({ page: 0, pageSize: 20 })
    );
  },
  component: AdminPage
});
