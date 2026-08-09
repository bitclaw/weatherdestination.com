import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { ApiKeysTable, apiKeysQueryOptions } from '@/features/api-keys';

export const Route = createFileRoute('/_app/dashboard/api-keys/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(apiKeysQueryOptions);
  },
  component: ApiKeysPage
});

function ApiKeysPage() {
  const { data: apiKeys } = useSuspenseQuery(apiKeysQueryOptions);

  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main className="gap-4 sm:gap-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">API Keys</h2>
            <p className="text-muted-foreground">
              Manage API keys for programmatic access to your account.
            </p>
          </div>
        </div>
        <ApiKeysTable data={apiKeys} />
      </Main>
    </>
  );
}
