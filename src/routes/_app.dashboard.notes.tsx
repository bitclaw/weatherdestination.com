import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { PATHS } from '@/lib/constants';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/notes')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    if (!ctx.flags.notes_enabled) throw redirect({ to: PATHS.DASHBOARD });
  },
  component: () => <Outlet />
});
