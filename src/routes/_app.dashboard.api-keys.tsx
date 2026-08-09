import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { PATHS } from '@/lib/constants';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/api-keys')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    if (!ctx.flags.api_keys_enabled) throw redirect({ to: PATHS.DASHBOARD });
  },
  component: () => <Outlet />
});
