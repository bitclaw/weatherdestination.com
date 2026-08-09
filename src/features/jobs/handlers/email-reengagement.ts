import type { Job } from '@bitclaw/jobs';
import { NonRetryableError } from '@bitclaw/jobs';
import type { AppJobs } from '@/features/jobs/types';
import { sendReengagementEmail } from '@/server/email';

export const handleReengagement = async (
  job: Job<AppJobs['email:reengagement']>
): Promise<void> => {
  const result = await sendReengagementEmail(job.data.email, job.data.name);
  if (!result.ok) {
    if (result.code === 'EMAIL_PROVIDER_NOT_CONFIGURED')
      throw new NonRetryableError(result.message);
    throw new Error(result.message);
  }
};
