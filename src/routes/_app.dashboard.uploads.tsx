import { createFileRoute } from '@tanstack/react-router';
import { subscriptionQueryOptions } from '@/features/billing';
import { uploadsQueryOptions } from '@/features/uploads';
import { UploadsPage } from '@/features/uploads/pages/index';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/uploads')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    await Promise.all([
      ctx.queryClient.prefetchQuery(uploadsQueryOptions),
      ctx.queryClient.prefetchQuery(subscriptionQueryOptions)
    ]);
  },
  component: UploadsPage
});
