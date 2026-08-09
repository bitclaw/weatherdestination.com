import { queryOptions } from '@tanstack/react-query';
import { auditLogQueryKey } from '@/lib/query-keys';
import { getAuditLogFn } from './server/audit-log.queries';

export { AuditLogTable } from './components/audit-log-table';
export { getAuditLogFn };

export const auditLogQueryOptions = queryOptions({
  queryKey: auditLogQueryKey(),
  queryFn: async () => {
    const result = await getAuditLogFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 30_000
});
