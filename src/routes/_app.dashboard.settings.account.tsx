import { createFileRoute } from '@tanstack/react-router';
import { accountSessionsQueryOptions } from '@/features/account';
import type { AppRouteContext } from '@/lib/types';
import { AccountPage } from '@/pages/settings/account-page';

export const Route = createFileRoute('/_app/dashboard/settings/account')({
  loader: async ({ context }) => {
    const { queryClient } = context as AppRouteContext;
    await queryClient.ensureQueryData(accountSessionsQueryOptions);
  },
  component: () => {
    const { user } = Route.useRouteContext() as AppRouteContext;
    return <AccountPage user={user} />;
  }
});
