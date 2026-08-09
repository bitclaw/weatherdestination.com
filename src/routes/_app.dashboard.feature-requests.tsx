import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { PATHS } from '@/lib/constants';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/feature-requests')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    if (!ctx.flags.feature_requests_enabled) {
      throw redirect({ to: PATHS.DASHBOARD });
    }
  },
  component: () => <Outlet />
});
