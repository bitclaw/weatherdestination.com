import type { Job } from '@bitclaw/jobs';
import type { AppJobs } from '@/features/jobs/types';

export const handleReengagementScan = async (
  _job: Job<AppJobs['email:reengagement-scan']>
): Promise<void> => {
  const [{ db }, { users }, { enqueue }, { and, eq, isNull, lt }] =
    await Promise.all([
      import('@/lib/db'),
      import('@/lib/db/schema'),
      import('@/features/jobs/enqueue.server'),
      import('drizzle-orm')
    ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const stale = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(
      and(
        lt(users.createdAt, thirtyDaysAgo),
        eq(users.hasAccess, false),
        isNull(users.reengagementSentAt)
      )
    );

  for (const user of stale) {
    // Enqueue first: enqueue() writes durably to the job queue's own SQLite
    // immediately, so if the process crashes before the flag update below,
    // the next scan re-marks a user whose email was already queued (a
    // harmless duplicate) rather than a user whose email was never queued at
    // all (a silently lost one).
    enqueue('email:reengagement', {
      userId: user.id,
      email: user.email,
      name: user.name
    });
    await db
      .update(users)
      .set({ reengagementSentAt: new Date() })
      .where(eq(users.id, user.id));
  }
};
