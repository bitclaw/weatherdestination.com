import type { Job } from '@bitclaw/jobs';
import type { AppJobs } from '@/features/jobs/types';

export const handleReconcileDeletions = async (
  _job: Job<AppJobs['account:reconcile-deletions']>
): Promise<void> => {
  const { reconcilePendingDeletions } = await import(
    '@/lib/operations/account-deletion.server'
  );
  const { processed, failed } = await reconcilePendingDeletions();
  if (failed > 0) {
    const { createLogger } = await import('@/lib/logger');
    createLogger({ module: 'jobs' }).error(
      { processed, failed },
      'pending account deletions still failing'
    );
  }
};
