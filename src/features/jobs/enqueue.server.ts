import type { AddJobOptions } from '@bitclaw/jobs';
import { getJobQueue } from '@/features/jobs/queue.server';
import type { AppJobs } from '@/features/jobs/types';

export const enqueue = <K extends string & keyof AppJobs>(
  type: K,
  data: AppJobs[K],
  options?: AddJobOptions
): number => {
  return getJobQueue().add(type, data, options);
};
