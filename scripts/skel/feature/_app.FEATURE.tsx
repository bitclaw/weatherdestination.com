import { createFileRoute } from '@tanstack/react-router';
import { entitiesQueryOptions, FeaturePage } from '@/features/FEATURE';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/FEATURE')({
  loader: async ({ context }) => {
    await (context as AppRouteContext).queryClient.prefetchQuery(
      entitiesQueryOptions
    );
  },
  component: FeaturePage
});
