import { createFileRoute } from '@tanstack/react-router';
import { config } from '@/config';
import {
  oneTimePurchaseQueryOptions,
  subscriptionQueryOptions
} from '@/features/billing';
import { BillingPage } from '@/features/billing/pages';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/billing')({
  validateSearch: (s: Record<string, unknown>) => ({
    // Leave undefined rather than coercing to `false` when absent: a
    // validated value that differs from the raw URL (nothing there vs.
    // an explicit `false`) makes TanStack Router issue a canonicalizing
    // redirect to write the default back into the URL - a full extra
    // round trip on every visit to a bare /dashboard/billing link. See
    // runmist's docs/runmist/performance.md cx33 load test, which
    // measured this exact route ~3-4x slower than everything else
    // because of it.
    success: s.success === 'true' || s.success === true ? true : undefined,
    canceled: s.canceled === 'true' || s.canceled === true ? true : undefined
  }),
  loader: async ({ context }) => {
    // Prefetch the query the page will actually suspend on: the one_time
    // page reads oneTimePurchaseQueryOptions, not the subscription query.
    const { queryClient } = context as AppRouteContext;
    if (config.billing.mode === 'one_time') {
      await queryClient.prefetchQuery(oneTimePurchaseQueryOptions);
    } else {
      await queryClient.prefetchQuery(subscriptionQueryOptions);
    }
  },
  component: () => {
    const { hasAccess, plan, isTrialing, trialEndsAt } =
      Route.useRouteContext() as AppRouteContext;
    const { success, canceled } = Route.useSearch();
    return (
      <BillingPage
        canceled={canceled ?? false}
        hasAccess={hasAccess}
        isTrialing={isTrialing}
        plan={plan}
        success={success ?? false}
        trialEndsAt={trialEndsAt}
      />
    );
  }
});
