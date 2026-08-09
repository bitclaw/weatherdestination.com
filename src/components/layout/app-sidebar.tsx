import { useQuery } from '@tanstack/react-query';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail
} from '@/components/ui/sidebar';
import { sidebarPreferencesQueryOptions } from '@/features/sidebar-preferences';
import type { AppRouteContext } from '@/lib/types';
import { AppTitle } from './app-title';
import { NavGroup } from './nav-group';
import { NavUser } from './nav-user';
import { getSidebarData } from './sidebar-data';

type AppSidebarProps = Pick<
  AppRouteContext,
  'user' | 'isAdmin' | 'plan' | 'flags'
>;

export const AppSidebar = ({ user, isAdmin, plan, flags }: AppSidebarProps) => {
  // Not suspended: the sidebar shell shouldn't block on this preference -
  // it renders with everything visible until the query resolves.
  const { data } = useQuery(sidebarPreferencesQueryOptions);
  const hidden = new Set(data?.hiddenUrls ?? []);
  const navGroups = getSidebarData(isAdmin, flags).map(group => ({
    ...group,
    items: group.items.filter(item => !hidden.has(item.url ?? ''))
  }));
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map(group => (
          <NavGroup key={group.title} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser plan={plan} user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
