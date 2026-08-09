import { createFileRoute, redirect } from '@tanstack/react-router';
import { creditsQueryOptions } from '@/features/credits';
import { PATHS } from '@/lib/constants';
import type { AppRouteContext } from '@/lib/types';
import { CreditsPage } from '@/pages/settings/credits-page';

export const Route = createFileRoute('/_app/dashboard/settings/credits')({
  validateSearch: (s: Record<string, unknown>) => ({
    success: s.success === 'true' || s.success === true
  }),
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    if (!ctx.flags.credits_enabled) throw redirect({ to: PATHS.DASHBOARD });
    await ctx.queryClient.prefetchQuery(creditsQueryOptions);
  },
  component: CreditsRoute
});

function CreditsRoute() {
  const { success } = Route.useSearch();
  return <CreditsPage success={success} />;
}
