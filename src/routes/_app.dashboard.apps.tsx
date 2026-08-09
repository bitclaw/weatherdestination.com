import { createFileRoute } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { AppsPage } from '@/features/apps/pages';

export const Route = createFileRoute('/_app/dashboard/apps')({
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
