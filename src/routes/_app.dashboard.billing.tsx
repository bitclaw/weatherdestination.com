import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { config } from '@/config';
import {
  oneTimePurchaseQueryOptions,
  subscriptionQueryOptions
} from '@/features/billing';
import { BillingPage } from '@/features/billing/pages';
import type { AppRouteContext } from '@/lib/types';

// Leave undefined rather than coercing to `false` when absent: a validated
// value that differs from the raw URL (nothing there vs. an explicit
// `false`) makes TanStack Router issue a canonicalizing redirect to write
// the default back into the URL - a full extra round trip on every visit to
// a bare /dashboard/billing link. See runmist's docs/runmist/performance.md
// cx33 load test, which measured this exact route ~3-4x slower than
// everything else because of it.
const toTrueOrUndefined = (v: unknown) =>
  v === 'true' || v === true ? true : undefined;
const searchSchema = z.object({
  success: z.preprocess(toTrueOrUndefined, z.literal(true).optional()),
  canceled: z.preprocess(toTrueOrUndefined, z.literal(true).optional()),
  session_id: z.string().optional()
});

export const Route = createFileRoute('/_app/dashboard/billing')({
  validateSearch: searchSchema,
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
    const { success, canceled, session_id: sessionId } = Route.useSearch();
    return (
      <BillingPage
        canceled={canceled ?? false}
        hasAccess={hasAccess}
        isTrialing={isTrialing}
        plan={plan}
        sessionId={sessionId}
        success={success ?? false}
        trialEndsAt={trialEndsAt}
      />
    );
  }
});
