import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { BadgeCheck, ChevronDown, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar';
import { authClient } from '@/lib/auth-client';
import { PATHS } from '@/lib/constants';
import { getSignOutAction } from '@/lib/multi-session';
import type { AppRouteContext } from '@/lib/types';

type NavUserProps = {
  user: AppRouteContext['user'];
  plan?: string;
};

export const NavUser = ({ user, plan }: NavUserProps) => {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);

  const userInitial = (user.name ?? user.email).charAt(0).toUpperCase();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const listResult = await authClient.multiSession.listDeviceSessions();
      const sessions = listResult.data ?? [];
      const action = getSignOutAction(
        sessions.map(s => ({
          sessionToken: s.session.token,
          isActive:
            s.session.token ===
            sessions.find(x => x.user.id === user.id)?.session.token
        }))
      );
      if (action.type === 'revoke') {
        await authClient.multiSession.revoke({
          sessionToken: action.sessionToken
        });
      } else {
        await authClient.signOut();
      }
      queryClient.clear();
      await router.navigate({ to: PATHS.LOGIN, replace: true });
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="group data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              size="lg"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">
                  {user.name ?? user.email.split('@')[0]}
                </span>
                <span className="flex items-center gap-1.5 truncate text-xs">
                  {user.email}
                  {plan && (
                    <Badge className="rounded-full px-1.5 py-0 text-[10px] font-normal capitalize">
                      {plan}
                    </Badge>
                  )}
                </span>
              </div>
              <ChevronDown className="ms-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg shadow-lg"
            side={isMobile ? 'bottom' : 'top'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {user.name ?? user.email.split('@')[0]}
                  </span>
                  <span className="flex items-center gap-1.5 truncate text-xs">
                    {user.email}
                    {plan && (
                      <Badge className="rounded-full px-1.5 py-0 text-[10px] font-normal capitalize">
                        {plan}
                      </Badge>
                    )}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to="/dashboard/settings">
                  <BadgeCheck />
                  Account settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={loggingOut}
              onClick={handleLogout}
              variant="destructive"
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
