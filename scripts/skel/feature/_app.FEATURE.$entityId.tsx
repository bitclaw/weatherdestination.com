import { createFileRoute } from '@tanstack/react-router';
import { entityDetailQueryOptions, FeatureEditPage } from '@/features/FEATURE';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/FEATURE/$entityId')({
  loader: async ({ context, params }) => {
    await (context as AppRouteContext).queryClient.prefetchQuery(
      entityDetailQueryOptions(params.entityId)
    );
  },
  // Route component wraps page component so entityId comes from route params.
  component: function FeatureEditRoute() {
    const { entityId } = Route.useParams();
    return <FeatureEditPage entityId={entityId} />;
  }
});
