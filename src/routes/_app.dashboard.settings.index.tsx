import { createFileRoute } from '@tanstack/react-router';
import type { AppRouteContext } from '@/lib/types';
import { ProfilePage } from '@/pages/settings/profile-page';

export const Route = createFileRoute('/_app/dashboard/settings/')({
  component: () => {
    const { user } = Route.useRouteContext() as AppRouteContext;
    return <ProfilePage user={user} />;
  }
});
