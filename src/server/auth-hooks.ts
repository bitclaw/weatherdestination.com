import type { AddJobOptions } from '@bitclaw/jobs';
import { eq } from 'drizzle-orm';
import { config } from '@/config';
import { enqueue } from '@/features/jobs/enqueue.server';
import type { AppJobs } from '@/features/jobs/types';
import type { db as sharedDb } from '@/lib/db';
import * as schema from '@/lib/db/schema';

export type EnqueueFn = <K extends string & keyof AppJobs>(
  type: K,
  payload: AppJobs[K],
  options?: AddJobOptions
) => unknown;

type CreditsConfig = { enabled: boolean; freeCreditsOnSignup: number };

export const onUserCreated = async (
  db: typeof sharedDb,
  user: { id: string; email: string; name: string },
  enqueueFn: EnqueueFn = enqueue,
  creditsConfig: CreditsConfig = config.credits
) => {
  enqueueFn(
    'email:welcome',
    { userId: user.id, email: user.email, name: user.name ?? null },
    { uniqueKey: `welcome:${user.id}` }
  );
  if (creditsConfig.enabled && creditsConfig.freeCreditsOnSignup > 0) {
    await db
      .update(schema.users)
      .set({
        credits: creditsConfig.freeCreditsOnSignup,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, user.id));
  }
};

// better-auth awaits databaseHooks.user.create.after as part of its own
// transaction wrapper, AFTER the user row has already committed, with
// nothing upstream catching a throw - it propagates all the way to the
// signup API response. The account already exists at that point, so a
// transient failure here (credits grant DB write, enqueue) shouldn't turn a
// successful signup into a client-visible error. These side effects are
// non-critical to auth itself: log and swallow, don't rethrow.
export const onUserCreatedSafely = async (
  db: typeof sharedDb,
  user: { id: string; email: string; name: string },
  enqueueFn: EnqueueFn = enqueue,
  creditsConfig: CreditsConfig = config.credits
): Promise<void> => {
  try {
    await onUserCreated(db, user, enqueueFn, creditsConfig);
  } catch (error) {
    // Dynamic import: @/lib/logger pulls in pino (node:os) and is outside
    // Vite's import-protection globs. A top-level import + module-scope
    // createLogger() call here is the exact pattern that leaked pino into
    // the client bundle from onboarding.ts.
    const { createLogger } = await import('@/lib/logger');
    createLogger({ module: 'auth-hooks' }).error(
      { userId: user.id, error },
      'onUserCreated failed'
    );
  }
};
