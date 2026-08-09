import { Outlet } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

export function AdminLayout() {
  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main className="gap-4 sm:gap-6" fixed>
        <Outlet />
      </Main>
    </>
  );
}
