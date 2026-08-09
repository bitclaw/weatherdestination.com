import { createFileRoute, redirect } from '@tanstack/react-router';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ERROR_CODES, PATHS } from '@/lib/constants';
import type { AppRouteContext } from '@/lib/types';
import { AppLayout } from '@/pages';
import { bootstrapQueryOptions } from '@/server/functions';

export type { AppRouteContext, AppUser } from '@/lib/types';

export const Route = createFileRoute('/_app')({
  ssr: 'data-only',
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  ),
  beforeLoad: async ({ context }) => {
    const result = await context.queryClient.ensureQueryData(
      bootstrapQueryOptions
    );
    if (!result.ok) {
      if (result.code === ERROR_CODES.ACCOUNT_DELETION_PENDING)
        throw redirect({ to: '/account-deleting' });
      throw new Error(result.message);
    }
    if (!result.data.user) {
      throw redirect({ to: PATHS.LOGIN });
    }
    if (!result.data.onboardingComplete) {
      throw redirect({ to: PATHS.ONBOARDING });
    }
    return {
      user: result.data.user,
      hasAccess: result.data.hasAccess,
      plan: result.data.plan,
      isTrialing: result.data.isTrialing ?? false,
      trialEndsAt: result.data.trialEndsAt ?? null,
      isAdmin: result.data.isAdmin ?? false,
      onboardingComplete: result.data.onboardingComplete
    };
  },
  // TooltipProvider/ToastProvider live here, not in __root - they're only
  // ever used inside the authenticated app (admin tables, settings pages,
  // mutation feedback), never on the public marketing pages, /login,
  // /signup, or /onboarding. __root.tsx previously wrapped every route
  // with both unconditionally, pulling their radix-ui modules into every
  // public page's preload list for no reason.
  component: () => {
    const { user, isAdmin, plan } = Route.useRouteContext() as AppRouteContext;
    return (
      <TooltipProvider>
        <ToastProvider>
          <AppLayout isAdmin={isAdmin} plan={plan} user={user} />
        </ToastProvider>
      </TooltipProvider>
    );
  }
});
