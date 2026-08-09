import { Outlet } from '@tanstack/react-router';
import { Bell, Monitor, Palette, UserCog, Wrench, Zap } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Separator } from '@/components/ui/separator';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { SidebarNav } from './sidebar-nav';

const baseSidebarNavItems = [
  {
    title: 'Profile',
    href: '/dashboard/settings',
    icon: <UserCog size={18} />
  },
  {
    title: 'Account',
    href: '/dashboard/settings/account',
    icon: <Wrench size={18} />
  },
  {
    title: 'Appearance',
    href: '/dashboard/settings/appearance',
    icon: <Palette size={18} />
  },
  {
    title: 'Notifications',
    href: '/dashboard/settings/notifications',
    icon: <Bell size={18} />
  },
  {
    title: 'Display',
    href: '/dashboard/settings/display',
    icon: <Monitor size={18} />
  }
];

export function SettingsLayout() {
  // Second, independent registration of the Credits nav entry (the primary
  // one is sidebar-data.ts, gated via route context) - this one has no
  // route context readily available, so it reads the flag directly.
  const { enabled: creditsEnabled } = useFeatureFlag('credits_enabled');
  const sidebarNavItems = creditsEnabled
    ? [
        ...baseSidebarNavItems,
        {
          title: 'Credits',
          href: '/dashboard/settings/credits',
          icon: <Zap size={18} />
        }
      ]
    : baseSidebarNavItems;

  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main fixed>
        <div className="space-y-0.5">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>
        <Separator className="my-4 lg:my-6" />
        <div className="flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-x-12 lg:space-y-0">
          <aside className="top-0 lg:sticky lg:w-1/5">
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className="flex w-full overflow-y-hidden p-1">
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  );
}
