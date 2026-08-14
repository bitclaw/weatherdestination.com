import { Outlet } from '@tanstack/react-router';
import { useState } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { authClient } from '@/lib/auth-client';
import type { AppRouteContext } from '@/lib/types';

const getSidebarCookie = () => {
  if (typeof document === 'undefined') return true;
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/);
  return match ? match[1] !== 'false' : true;
};

export function AppLayout({
  user,
  isAdmin,
  plan,
  flags
}: Pick<AppRouteContext, 'user' | 'isAdmin' | 'plan' | 'flags'>) {
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  const { data: sessionData } = authClient.useSession();
  const impersonatedBy = (
    sessionData?.session as { impersonatedBy?: string } | undefined
  )?.impersonatedBy;

  return (
    <SidebarProvider defaultOpen={getSidebarCookie()}>
      <AppSidebar flags={flags} isAdmin={isAdmin} plan={plan} user={user} />
      <SidebarInset className="@container/content has-data-[layout=fixed]:h-svh">
        {impersonatedBy && (
          <div className="flex h-10 items-center justify-between border-b bg-warning/10 px-4 text-warning">
            <span className="text-xs font-medium">
              Impersonating {user.email}
            </span>
            <button
              className="text-xs font-medium underline underline-offset-2 disabled:opacity-50"
              disabled={stoppingImpersonation}
              onClick={async () => {
                setStoppingImpersonation(true);
                await authClient.admin.stopImpersonating();
                window.location.href = '/dashboard/admin';
              }}
              type="button"
            >
              {stoppingImpersonation ? 'Stopping…' : 'Stop impersonating'}
            </button>
          </div>
        )}
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
