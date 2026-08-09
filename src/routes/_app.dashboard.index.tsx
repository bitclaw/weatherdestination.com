import { createFileRoute } from '@tanstack/react-router';
import type { AppRouteContext } from '@/lib/types';
import { DashboardPage } from '@/pages/dashboard';

export const Route = createFileRoute('/_app/dashboard/')({
  component: () => {
    const { user, hasAccess, plan, flags } =
      Route.useRouteContext() as AppRouteContext;
    return (
      <DashboardPage
        flags={flags}
        hasAccess={hasAccess}
        plan={plan}
        user={user}
      />
    );
  }
});
