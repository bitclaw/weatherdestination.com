import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import {
  FeatureRequestsTable,
  featureRequestsQueryOptions
} from '@/features/feature-requests';
import { bootstrapQueryOptions } from '@/server/functions';

export const Route = createFileRoute('/_app/dashboard/feature-requests/')({
  validateSearch: z.object({
    drawer: z.enum(['create', 'edit']).optional(),
    id: z.string().optional()
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(featureRequestsQueryOptions);
  },
  component: FeatureRequestsPage
});

function FeatureRequestsPage() {
  const { data: requests } = useSuspenseQuery(featureRequestsQueryOptions);
  // Reactive, not route context (CLAUDE.md: route context is only
  // re-evaluated on cross-parent navigation, so it can go stale if admin
  // status changes mid-session).
  const { data: bootstrap } = useQuery(bootstrapQueryOptions);
  const isAdmin =
    (bootstrap?.ok && 'isAdmin' in bootstrap.data && bootstrap.data.isAdmin) ??
    false;
  const { drawer, id } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const drawerOpen = drawer === 'create' || drawer === 'edit';
  const openCreate = () =>
    navigate({ search: { drawer: 'create', id: undefined } });
  const openEdit = (editId: string) =>
    navigate({ search: { drawer: 'edit', id: editId } });
  const closeDrawer = () =>
    navigate({ search: { drawer: undefined, id: undefined } });

  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main className="gap-4 sm:gap-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Feature Requests
            </h2>
            <p className="text-muted-foreground">
              Vote for the features you want to see next.
            </p>
          </div>
        </div>
        <FeatureRequestsTable
          data={requests}
          drawerOpen={drawerOpen}
          editId={id}
          isAdmin={isAdmin}
          onCloseDrawer={closeDrawer}
          onOpenCreate={openCreate}
          onOpenEdit={openEdit}
        />
      </Main>
    </>
  );
}
