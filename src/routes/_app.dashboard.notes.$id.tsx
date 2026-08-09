import { createFileRoute } from '@tanstack/react-router';
import { noteDetailQueryOptions } from '@/features/notes';
import { NoteEditPage } from '@/features/notes/pages/detail';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/notes/$id')({
  loader: async ({ params, context }) => {
    await (context as AppRouteContext).queryClient.prefetchQuery(
      noteDetailQueryOptions(params.id)
    );
  },
  component: function NoteEditRoute() {
    const { id } = Route.useParams();
    return <NoteEditPage id={id} />;
  }
});
