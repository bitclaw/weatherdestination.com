import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { AuditLogTable, auditLogQueryOptions } from '@/features/audit-log';

export const Route = createFileRoute('/_app/dashboard/audit-log/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(auditLogQueryOptions);
  },
  component: AuditLogPage
});

function AuditLogPage() {
  const { data: events } = useSuspenseQuery(auditLogQueryOptions);

  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main className="gap-4 sm:gap-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Audit Log</h2>
            <p className="text-muted-foreground">
              A record of all actions taken in your account.
            </p>
          </div>
        </div>
        <AuditLogTable data={events} />
      </Main>
    </>
  );
}
