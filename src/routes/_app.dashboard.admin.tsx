import { createFileRoute, redirect } from '@tanstack/react-router';
import { PATHS } from '@/lib/constants';
import type { AppRouteContext } from '@/lib/types';
import { AdminLayout } from '@/pages/admin';

export const Route = createFileRoute('/_app/dashboard/admin')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    if (!ctx.isAdmin) throw redirect({ to: PATHS.DASHBOARD });
  },
  component: AdminLayout
});
