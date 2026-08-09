import { createFileRoute } from '@tanstack/react-router';
import { adminUserDetailQueryOptions } from '@/features/admin';
import { AdminUserDetailPage } from '@/features/admin/pages/detail';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/admin/$userId')({
  loader: async ({ context, params }) => {
    const ctx = context as AppRouteContext;
    await ctx.queryClient.prefetchQuery(
      adminUserDetailQueryOptions(params.userId)
    );
  },
  component: () => {
    const { userId } = Route.useParams();
    return <AdminUserDetailPage userId={userId} />;
  }
});
