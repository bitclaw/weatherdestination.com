import { Link } from '@tanstack/react-router';
import { Logo } from '@/components/Logo';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';
import { config } from '@/config';

export const AppTitle = () => (
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton asChild size="lg">
        <Link className="gap-2" to="/dashboard">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Logo className="size-5" />
          </div>
          <div className="grid flex-1 text-start text-sm leading-tight">
            <span className="truncate font-semibold">{config.appName}</span>
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
);
