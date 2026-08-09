import type { Job } from '@bitclaw/jobs';
import { NonRetryableError } from '@bitclaw/jobs';
import type { AppJobs } from '@/features/jobs/types';
import { sendTrialExpiringEmail } from '@/server/email';

export const handleTrialExpiring = async (
  job: Job<AppJobs['email:trial-expiring']>
): Promise<void> => {
  const result = await sendTrialExpiringEmail(
    job.data.email,
    job.data.name,
    job.data.daysLeft
  );
  if (!result.ok) {
    if (result.code === 'EMAIL_PROVIDER_NOT_CONFIGURED')
      throw new NonRetryableError(result.message);
    throw new Error(result.message);
  }
};
