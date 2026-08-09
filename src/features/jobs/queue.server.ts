import path from 'node:path';
import { JobQueue } from '@bitclaw/jobs';
import type { AppJobs } from '@/features/jobs/types';

let queue: JobQueue<AppJobs> | null = null;

export const getJobQueue = (): JobQueue<AppJobs> => {
  if (!queue) {
    queue = new JobQueue<AppJobs>(
      process.env.JOBS_DB_PATH ?? path.resolve(process.cwd(), 'data', 'jobs.db')
    );
  }
  return queue;
};

export const closeJobQueue = (): void => {
  if (queue) {
    queue.close();
    queue = null;
  }
};
