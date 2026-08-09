import type {
  FailedJob,
  Job,
  JobStats,
  ListJobsOptions,
  PaginatedResult,
  PurgeOptions,
  Schedule
} from '@bitclaw/jobs';
import { err, ok, type Result } from '@bitclaw/result';
import { ERROR_CODES } from '@/lib/constants';

// =============================================================================
// INJECTABLE INTERFACES
// =============================================================================

export type SchedulerLike = {
  getSchedules(): Schedule[];
  pauseSchedule(name: string): void;
  resumeSchedule(name: string): void;
};

export type JobQueueLike = {
  getStats(): JobStats;
  listJobs(options: ListJobsOptions): PaginatedResult<Job>;
  getJobTypes(): string[];
  cancelJob(id: number): boolean;
  getFailedJobs(options: {
    type?: string;
    limit?: number;
    offset?: number;
  }): PaginatedResult<FailedJob>;
  forceRetryJob(id: number): boolean;
  retryFailedJob(failedJobId: number): number;
  purge(options: PurgeOptions): number;
  purgeFailedJobs(olderThanMs: number): number;
};

// =============================================================================
// SERIALIZERS
// =============================================================================

// Job.data is unknown , not serializable through TanStack server fns.
// Convert to JSON string for admin display.
export const serializeSchedule = (s: Schedule) => ({
  ...s,
  data: JSON.stringify(s.data)
});

export const serializeJob = (j: Job) => ({
  ...j,
  data: JSON.stringify(j.data),
  result: j.result !== null ? JSON.stringify(j.result) : null
});

export const serializeFailedJob = (d: FailedJob) => ({
  ...d,
  data: JSON.stringify(d.data)
});

// =============================================================================
// PURE LOGIC FUNCTIONS
// =============================================================================

export function getJobStatsLogic(queue: JobQueueLike): Result<JobStats> {
  return ok(queue.getStats());
}

export function listJobsLogic(
  queue: JobQueueLike,
  filters: ListJobsOptions
): Result<{ items: ReturnType<typeof serializeJob>[]; total: number }> {
  const result = queue.listJobs(filters);
  return ok({
    items: result.items.map(serializeJob),
    total: result.total
  });
}

export function getJobTypesLogic(queue: JobQueueLike): Result<string[]> {
  return ok(queue.getJobTypes());
}

export function cancelJobLogic(
  queue: JobQueueLike,
  id: number
): Result<{ success: boolean }> {
  const success = queue.cancelJob(id);
  if (!success)
    return err(ERROR_CODES.CANCEL_FAILED, 'Job cannot be cancelled');
  return ok({ success: true });
}

export function listFailedJobsLogic(
  queue: JobQueueLike,
  filters: { type?: string; limit: number; offset: number }
): Result<{ items: ReturnType<typeof serializeFailedJob>[]; total: number }> {
  const result = queue.getFailedJobs(filters);
  return ok({
    items: result.items.map(serializeFailedJob),
    total: result.total
  });
}

export function forceRetryJobLogic(
  queue: JobQueueLike,
  id: number
): Result<{ success: boolean }> {
  const success = queue.forceRetryJob(id);
  if (!success)
    return err(
      ERROR_CODES.RETRY_FAILED,
      'Job could not be retried , it may no longer be in a retryable state'
    );
  return ok({ success: true });
}

export function retryFailedJobLogic(
  queue: JobQueueLike,
  failedJobId: number
): Result<{ newJobId: number }> {
  try {
    const newJobId = queue.retryFailedJob(failedJobId);
    return ok({ newJobId });
  } catch {
    return err(
      ERROR_CODES.RETRY_FAILED,
      'Failed job not found or retry failed'
    );
  }
}

export function purgeJobsLogic(
  queue: JobQueueLike,
  options: PurgeOptions
): Result<{ purged: number }> {
  const purged = queue.purge(options);
  return ok({ purged });
}

export function purgeFailedJobsLogic(
  queue: JobQueueLike,
  olderThanMs: number
): Result<{ purged: number }> {
  const purged = queue.purgeFailedJobs(olderThanMs);
  return ok({ purged });
}

// =============================================================================
// SCHEDULER LOGIC
// =============================================================================

export function getSchedulesLogic(
  scheduler: SchedulerLike
): Result<ReturnType<typeof serializeSchedule>[]> {
  return ok(scheduler.getSchedules().map(serializeSchedule));
}

export function pauseScheduleLogic(
  scheduler: SchedulerLike,
  name: string
): Result<{ success: boolean }> {
  scheduler.pauseSchedule(name);
  return ok({ success: true });
}

export function resumeScheduleLogic(
  scheduler: SchedulerLike,
  name: string
): Result<{ success: boolean }> {
  scheduler.resumeSchedule(name);
  return ok({ success: true });
}
