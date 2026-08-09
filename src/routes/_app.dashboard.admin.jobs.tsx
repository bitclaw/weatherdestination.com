import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import {
  activeJobsQueryOptions,
  cancelAdminJob,
  failedJobsQueryOptions,
  forceRetryAdminJob,
  jobStatsQueryOptions,
  jobTypesQueryOptions,
  purgeAdminJobs,
  purgeFailedAdminJobs,
  retryFailedAdminJob
} from '@/features/jobs';
import {
  adminFailedJobsPrefixKey,
  adminJobStatsQueryKey,
  adminJobsListPrefixKey
} from '@/lib/query-keys';
import type { AppRouteContext } from '@/lib/types';
import { relativeTime } from '@/lib/utils';

const DEFAULT_LIMIT = 10;

export const Route = createFileRoute('/_app/dashboard/admin/jobs')({
  loader: async ({ context }) => {
    const { queryClient } = context as AppRouteContext;
    await Promise.all([
      queryClient.prefetchQuery(jobStatsQueryOptions),
      queryClient.prefetchQuery(jobTypesQueryOptions),
      queryClient.prefetchQuery(
        activeJobsQueryOptions({ limit: DEFAULT_LIMIT, offset: 0 })
      )
    ]);
  },
  component: JobManagementPage
});

type Tab = 'active' | 'failed';

function statusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline' {
  switch (status) {
    case 'done':
      return 'success';
    case 'processing':
      return 'warning';
    case 'pending':
      return 'secondary';
    case 'failed':
      return 'destructive';
    case 'blocked':
      return 'outline';
    case 'cancelled':
      return 'outline';
    default:
      return 'default';
  }
}

function JobManagementPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: stats } = useSuspenseQuery(jobStatsQueryOptions);
  const { data: jobTypes } = useSuspenseQuery(jobTypesQueryOptions);

  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);

  const [failedTypeFilter, setFailedTypeFilter] = useState('');
  const [failedOffset, setFailedOffset] = useState(0);

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: adminJobStatsQueryKey() });
    // Prefix match, not adminJobsQueryKey()/adminFailedJobsQueryKey() with no
    // args , those build a key with explicit `undefined` filter slots, which
    // only matches a query keyed with the SAME undefined slots. Whenever a
    // status/type filter is active the real query key has a concrete string
    // in that slot, so an exact-key invalidate silently misses it. A
    // 3-element prefix matches any active/failed jobs query regardless of
    // filter state.
    queryClient.invalidateQueries({ queryKey: adminJobsListPrefixKey() });
    queryClient.invalidateQueries({ queryKey: adminFailedJobsPrefixKey() });
    router.invalidate();
  };

  const handleCancel = async (id: number) => {
    setRunning(`cancel-${id}`);
    setError(null);
    try {
      const res = await cancelAdminJob({ data: { id } });
      if (!res.ok) setError(res.message ?? 'Cancel failed');
      else setLastResult(`Job #${id} cancelled.`);
      invalidateJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  };

  const handleForceRetry = async (id: number) => {
    setRunning(`retry-${id}`);
    setError(null);
    try {
      const res = await forceRetryAdminJob({ data: { id } });
      if (!res.ok) setError(res.message ?? 'Retry failed');
      else setLastResult(`Job #${id} reset to pending.`);
      invalidateJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  };

  const handleRetryFailed = async (failedJobId: number) => {
    setRunning(`retry-failed-${failedJobId}`);
    setError(null);
    try {
      const res = await retryFailedAdminJob({ data: { failedJobId } });
      if (!res.ok) setError(res.message ?? 'Retry failed');
      else setLastResult(`Re-queued as job #${res.data.newJobId}.`);
      invalidateJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  };

  const handlePurge = async (type: 'completed' | 'failed') => {
    setRunning(`purge-${type}`);
    setError(null);
    setLastResult(null);
    try {
      let res: Awaited<
        ReturnType<typeof purgeAdminJobs | typeof purgeFailedAdminJobs>
      >;
      if (type === 'completed') {
        res = await purgeAdminJobs({
          data: { status: 'done', olderThanDays: 1 }
        });
      } else {
        res = await purgeFailedAdminJobs({ data: { olderThanDays: 7 } });
      }
      if (res.ok) setLastResult(`Purged ${res.data.purged} ${type} job(s).`);
      else setError(res.message ?? 'Purge failed');
      invalidateJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Job Queue</h1>
        <p className="text-muted-foreground">
          Monitor and manage background jobs
        </p>
      </div>

      <ErrorBanner className="mb-4" message={error} />
      <ErrorBanner className="mb-4" message={lastResult} variant="success" />

      {stats && (
        <div className="mb-6 grid grid-cols-4 gap-3 lg:grid-cols-7">
          {(
            [
              {
                label: 'Pending',
                value: stats.pending,
                icon: Clock,
                color: 'text-yellow-600'
              },
              {
                label: 'Processing',
                value: stats.processing,
                icon: RefreshCw,
                color: 'text-blue-600'
              },
              {
                label: 'Done',
                value: stats.done,
                icon: CheckCircle,
                color: 'text-green-600'
              },
              {
                label: 'Failed',
                value: stats.failed,
                icon: XCircle,
                color: 'text-red-600'
              },
              {
                label: 'Dead',
                value: stats.dead,
                icon: Ban,
                color: 'text-red-800'
              },
              {
                label: 'Blocked',
                value: stats.blocked,
                icon: AlertTriangle,
                color: 'text-orange-600'
              },
              {
                label: 'Cancelled',
                value: stats.cancelled,
                icon: XCircle,
                color: 'text-muted-foreground'
              }
            ] as const
          ).map(({ label, value, icon: Icon, color }) => (
            <div className="rounded-lg border p-3" key={label}>
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-muted-foreground text-xs">{label}</span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex gap-2 border-b">
        {(['active', 'failed'] as Tab[]).map(tab => (
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-current'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab === 'active' ? 'Active Jobs' : 'Failed Jobs'}
          </button>
        ))}
      </div>

      {activeTab === 'active' ? (
        <ActiveJobsTab
          jobTypes={jobTypes}
          limit={limit}
          offset={offset}
          onCancel={handleCancel}
          onForceRetry={handleForceRetry}
          onLimitChange={v => {
            setLimit(v);
            setOffset(0);
          }}
          onOffsetChange={setOffset}
          onStatusChange={v => {
            setStatusFilter(v);
            setOffset(0);
          }}
          onTypeChange={v => {
            setTypeFilter(v);
            setOffset(0);
          }}
          running={running}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
        />
      ) : (
        <FailedJobsTab
          jobTypes={jobTypes}
          limit={DEFAULT_LIMIT}
          offset={failedOffset}
          onOffsetChange={setFailedOffset}
          onRetry={handleRetryFailed}
          onTypeChange={v => {
            setFailedTypeFilter(v);
            setFailedOffset(0);
          }}
          running={running}
          typeFilter={failedTypeFilter}
        />
      )}

      <section className="mt-8">
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
          Maintenance
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            className="hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
            disabled={running !== null}
            onClick={() => handlePurge('completed')}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            {running === 'purge-completed'
              ? 'Purging...'
              : 'Purge completed >1d'}
          </button>
          <button
            className="border-destructive/50 text-destructive hover:bg-destructive/10 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
            disabled={running !== null}
            onClick={() => handlePurge('failed')}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            {running === 'purge-failed' ? 'Purging...' : 'Purge failed >7d'}
          </button>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Jobs Tab
// ---------------------------------------------------------------------------

type ActiveTabProps = {
  statusFilter: string;
  typeFilter: string;
  limit: number;
  offset: number;
  jobTypes: string[];
  running: string | null;
  onStatusChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onLimitChange: (v: number) => void;
  onOffsetChange: (v: number) => void;
  onCancel: (id: number) => void;
  onForceRetry: (id: number) => void;
};

function ActiveJobsTab({
  statusFilter,
  typeFilter,
  limit,
  offset,
  jobTypes,
  running,
  onStatusChange,
  onTypeChange,
  onLimitChange,
  onOffsetChange,
  onCancel,
  onForceRetry
}: ActiveTabProps) {
  const { data: result } = useSuspenseQuery(
    activeJobsQueryOptions({
      status: (statusFilter || undefined) as
        | 'active'
        | 'done'
        | 'failed'
        | 'waiting'
        | 'running'
        | undefined,
      type: typeFilter || undefined,
      limit,
      offset
    })
  );
  const jobs = result.items;
  const total = result.total;

  const STATUSES = [
    'pending',
    'processing',
    'done',
    'failed',
    'blocked',
    'cancelled'
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="bg-background rounded-md border px-2 py-1.5 text-sm"
          onChange={e => onStatusChange(e.target.value)}
          value={statusFilter}
        >
          <option value="">All statuses</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="bg-background rounded-md border px-2 py-1.5 text-sm"
          onChange={e => onTypeChange(e.target.value)}
          value={typeFilter}
        >
          <option value="">All types</option>
          {jobTypes.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="bg-background rounded-md border px-2 py-1.5 text-sm"
          onChange={e => onLimitChange(Number(e.target.value))}
          value={limit}
        >
          {[5, 10, 25].map(n => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <span className="text-muted-foreground text-sm">{total} total</span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b text-left">
              <th className="px-4 py-2 font-medium">ID</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Retries</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-4 py-6 text-center"
                  colSpan={6}
                >
                  No jobs found
                </td>
              </tr>
            ) : (
              jobs.map(job => (
                <tr className="border-t" key={job.id}>
                  <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                    #{job.id}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{job.type}</td>
                  <td className="px-4 py-2">
                    <Badge variant={statusBadgeVariant(job.status)}>
                      {job.status}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-2 text-xs tabular-nums">
                    {job.retryCount}/{job.maxRetries}
                  </td>
                  <td className="text-muted-foreground px-4 py-2 text-xs">
                    {relativeTime(new Date(job.createdAt).getTime())}
                  </td>
                  <td className="flex gap-1 px-4 py-2">
                    {(job.status === 'pending' || job.status === 'blocked') && (
                      <Button
                        disabled={running !== null}
                        onClick={() => onCancel(job.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Ban className="h-3 w-3" />
                      </Button>
                    )}
                    {(job.status === 'processing' ||
                      job.status === 'cancelled') && (
                      <Button
                        disabled={running !== null}
                        onClick={() => onForceRetry(job.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                    {job.error && (
                      <details className="inline">
                        <summary className="text-muted-foreground cursor-pointer text-xs">
                          error
                        </summary>
                        <pre className="bg-muted absolute z-10 mt-1 max-w-sm overflow-auto rounded p-2 text-xs">
                          {job.error}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex items-center gap-2">
          <Button
            disabled={offset === 0}
            onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            size="sm"
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <Button
            disabled={offset + limit >= total}
            onClick={() => onOffsetChange(offset + limit)}
            size="sm"
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Failed Jobs Tab
// ---------------------------------------------------------------------------

type FailedTabProps = {
  typeFilter: string;
  limit: number;
  offset: number;
  jobTypes: string[];
  running: string | null;
  onTypeChange: (v: string) => void;
  onOffsetChange: (v: number) => void;
  onRetry: (failedJobId: number) => void;
};

function FailedJobsTab({
  typeFilter,
  limit,
  offset,
  jobTypes,
  running,
  onTypeChange,
  onOffsetChange,
  onRetry
}: FailedTabProps) {
  const { data: result } = useSuspenseQuery(
    failedJobsQueryOptions({ type: typeFilter || undefined, limit, offset })
  );
  const jobs = result.items;
  const total = result.total;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="bg-background rounded-md border px-2 py-1.5 text-sm"
          onChange={e => onTypeChange(e.target.value)}
          value={typeFilter}
        >
          <option value="">All types</option>
          {jobTypes.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground text-sm">
          {total} dead-lettered
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b text-left">
              <th className="px-4 py-2 font-medium">ID</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Error</th>
              <th className="px-4 py-2 font-medium">Failed</th>
              <th className="px-4 py-2 font-medium">Retries</th>
              <th className="px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-4 py-6 text-center"
                  colSpan={6}
                >
                  No failed jobs
                </td>
              </tr>
            ) : (
              jobs.map(job => (
                <tr className="border-t" key={job.id}>
                  <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                    #{job.id}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{job.type}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-xs text-red-600">
                    {job.error ?? '—'}
                  </td>
                  <td className="text-muted-foreground px-4 py-2 text-xs">
                    {relativeTime(new Date(job.failedAt).getTime())}
                  </td>
                  <td className="text-muted-foreground px-4 py-2 text-xs tabular-nums">
                    {job.retryCount}/{job.maxRetries}
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      disabled={running !== null}
                      onClick={() => onRetry(job.id)}
                      size="sm"
                      variant="outline"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Retry
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex items-center gap-2">
          <Button
            disabled={offset === 0}
            onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            size="sm"
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <Button
            disabled={offset + limit >= total}
            onClick={() => onOffsetChange(offset + limit)}
            size="sm"
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
