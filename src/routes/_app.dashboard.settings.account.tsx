import { createFileRoute } from '@tanstack/react-router';
import type { AppRouteContext } from '@/lib/types';
import { AccountPage } from '@/pages/settings/account-page';

export const Route = createFileRoute('/_app/dashboard/settings/account')({
  component: () => {
    const { user } = Route.useRouteContext() as AppRouteContext;
    return <AccountPage user={user} />;
  }
});
