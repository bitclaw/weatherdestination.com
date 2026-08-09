import type { Job } from '@bitclaw/jobs';
import type { AppJobs } from '@/features/jobs/types';

export const handleSnapshotMrr = async (
  _job: Job<AppJobs['analytics:snapshot-mrr']>
): Promise<void> => {
  const { snapshotCurrentMonthMrr } = await import(
    '@/features/admin/server/admin-analytics.server'
  );
  const { db } = await import('@/lib/db');
  await snapshotCurrentMonthMrr(db);
};
