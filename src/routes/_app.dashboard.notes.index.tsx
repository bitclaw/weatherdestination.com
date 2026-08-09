import { createFileRoute } from '@tanstack/react-router';
import { subscriptionQueryOptions } from '@/features/billing';
import { notesQueryOptions } from '@/features/notes';
import { NotesPage } from '@/features/notes/pages';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/notes/')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    await Promise.all([
      ctx.queryClient.prefetchQuery(notesQueryOptions),
      ctx.queryClient.prefetchQuery(subscriptionQueryOptions)
    ]);
  },
  component: NotesPage
});
