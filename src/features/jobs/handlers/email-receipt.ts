import type { Job } from '@bitclaw/jobs';
import { NonRetryableError } from '@bitclaw/jobs';
import type { AppJobs } from '@/features/jobs/types';
import { sendReceiptEmail } from '@/server/email';

export const handleReceiptEmail = async (
  job: Job<AppJobs['email:receipt']>
): Promise<void> => {
  const result = await sendReceiptEmail(
    job.data.email,
    job.data.name,
    job.data.planName,
    job.data.amount,
    job.data.currency
  );
  if (!result.ok) {
    if (result.code === 'EMAIL_PROVIDER_NOT_CONFIGURED')
      throw new NonRetryableError(result.message);
    throw new Error(result.message);
  }
};
