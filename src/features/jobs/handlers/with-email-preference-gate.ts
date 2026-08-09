import type { Job } from '@bitclaw/jobs';
import { getSetting } from '@/lib/db/settings-helpers.server';
import { getUserDb } from '@/lib/db/user-db';

// Composable wrapper for gating a job handler on a per-user email preference,
// rather than duplicating the same check inside every marketing-ish handler.
// Default is opt-in: no setting row (null) means send - a new user isn't
// silently excluded from nurture emails before ever visiting settings.
export const withEmailPreferenceGate = <T extends { userId: string }>(
  settingKey: string,
  handler: (job: Job<T>) => Promise<void>
) => {
  return async (job: Job<T>): Promise<void> => {
    const db = getUserDb(job.data.userId);
    if (getSetting(db, settingKey) === '0') return;
    await handler(job);
  };
};
