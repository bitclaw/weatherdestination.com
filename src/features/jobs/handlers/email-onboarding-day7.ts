import type { Job } from '@bitclaw/jobs';
import { NonRetryableError } from '@bitclaw/jobs';
import type { AppJobs } from '@/features/jobs/types';
import { sendOnboardingDay7Email } from '@/server/email';

export const handleOnboardingDay7 = async (
  job: Job<AppJobs['email:onboarding-day7']>
): Promise<void> => {
  const result = await sendOnboardingDay7Email(job.data.email, job.data.name);
  if (!result.ok) {
    if (result.code === 'EMAIL_PROVIDER_NOT_CONFIGURED')
      throw new NonRetryableError(result.message);
    throw new Error(result.message);
  }
};
