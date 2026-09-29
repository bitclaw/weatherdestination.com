import path from 'node:path';
import { JobQueue } from '@bitclaw/jobs';
import type { AppJobs } from '@/features/jobs/types';
import { runInEmailIdempotencyScope } from '@/server/email';

let queue: JobQueue<AppJobs> | null = null;

export const getJobQueue = (): JobQueue<AppJobs> => {
  if (!queue) {
    queue = new JobQueue<AppJobs>(
      process.env.JOBS_DB_PATH ?? path.resolve(process.cwd(), 'data', 'jobs.db')
    );
    // Scope every job so emails it sends carry a rerun-stable idempotency
    // key - see runInEmailIdempotencyScope in src/server/email.ts.
    queue.use((job, next) =>
      runInEmailIdempotencyScope(`${job.type}:${job.id}`, next)
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
