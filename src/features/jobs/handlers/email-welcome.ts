import type { Job } from '@bitclaw/jobs';
import { NonRetryableError } from '@bitclaw/jobs';
import { enqueue } from '@/features/jobs/enqueue.server';
import type { AppJobs } from '@/features/jobs/types';
import { sendWelcomeEmail } from '@/server/email';

const DAY_MS = 24 * 60 * 60 * 1000;

export const handleWelcomeEmail = async (
  job: Job<AppJobs['email:welcome']>
): Promise<void> => {
  const result = await sendWelcomeEmail(job.data.email, job.data.name);
  if (!result.ok) {
    // Provider not configured: permanent , no point retrying
    if (result.code === 'EMAIL_PROVIDER_NOT_CONFIGURED')
      throw new NonRetryableError(result.message);
    throw new Error(result.message);
  }

  // uniqueKey + dedup: if this handler is retried (e.g. a crash after
  // sendWelcomeEmail but before both enqueues complete), re-running these
  // calls won't double-schedule the follow-up chain - a pending job with the
  // same (type, uniqueKey) is silently ignored. The welcome email itself has
  // no equivalent guard (Resend has no "already sent" check we can key on),
  // so a retry in that narrow crash window can still resend it once; that's
  // an accepted, bounded gap, not the unbounded one this fixes.
  enqueue('email:onboarding-day3', job.data, {
    runAt: new Date(Date.now() + 3 * DAY_MS),
    uniqueKey: `email:onboarding-day3:${job.data.email}`,
    dedup: 'ignore'
  });
  enqueue('email:onboarding-day7', job.data, {
    runAt: new Date(Date.now() + 7 * DAY_MS),
    uniqueKey: `email:onboarding-day7:${job.data.email}`,
    dedup: 'ignore'
  });
};
