import { queryOptions } from '@tanstack/react-query';
import {
  adminFailedJobsQueryKey,
  adminJobStatsQueryKey,
  adminJobsQueryKey,
  adminJobTypesQueryKey,
  adminSchedulesQueryKey
} from '@/lib/query-keys';
import {
  getJobStats,
  getJobTypes,
  getSchedulesList,
  listAdminJobs,
  listFailedAdminJobs
} from './server/jobs-admin.queries';

// enqueue, startWorkers, and stopWorkers are plain functions (not
// createServerFn) that import queue.server.ts/scheduler.server.ts , they
// must bypass the barrel per the *.server.ts import-protection convention.
// Import them directly: '@/features/jobs/enqueue.server', '@/features/jobs/workers'.
export {
  cancelAdminJob,
  forceRetryAdminJob,
  pauseScheduleAdmin,
  purgeAdminJobs,
  purgeFailedAdminJobs,
  resumeScheduleAdmin,
  retryFailedAdminJob
} from './server/jobs-admin.mutations';
export type { AppJobs } from './types';

export const schedulesQueryOptions = queryOptions({
  queryKey: adminSchedulesQueryKey(),
  queryFn: async () => {
    const result = await getSchedulesList();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 30_000
});

export const jobStatsQueryOptions = queryOptions({
  queryKey: adminJobStatsQueryKey(),
  queryFn: async () => {
    const result = await getJobStats();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 10_000,
  refetchInterval: 15_000
});

export const jobTypesQueryOptions = queryOptions({
  queryKey: adminJobTypesQueryKey(),
  queryFn: async () => {
    const result = await getJobTypes();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 60_000
});

export const activeJobsQueryOptions = (opts: {
  status?: 'active' | 'done' | 'failed' | 'waiting' | 'running';
  type?: string;
  limit: number;
  offset: number;
}) =>
  queryOptions({
    queryKey: adminJobsQueryKey(
      opts.status,
      opts.type,
      opts.limit,
      opts.offset
    ),
    queryFn: async () => {
      const result = await listAdminJobs({ data: opts });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: 10_000
  });

export const failedJobsQueryOptions = (opts: {
  type?: string;
  limit: number;
  offset: number;
}) =>
  queryOptions({
    queryKey: adminFailedJobsQueryKey(opts.type, opts.limit, opts.offset),
    queryFn: async () => {
      const result = await listFailedAdminJobs({ data: opts });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: 10_000
  });
