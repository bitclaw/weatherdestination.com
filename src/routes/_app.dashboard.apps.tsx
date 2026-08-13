import { createFileRoute, redirect } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { AppsPage } from '@/features/apps/pages';
import { PATHS } from '@/lib/constants';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/apps')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    if (!ctx.flags.apps_enabled) throw redirect({ to: PATHS.DASHBOARD });
  },
  component: AppsRoute
});

function AppsRoute() {
  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main fixed>
        <AppsPage />
      </Main>
    </>
  );
}
