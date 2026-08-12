import { eq } from 'drizzle-orm';
import type { db as sharedDb } from '@/lib/db';
import { users } from '@/lib/db/schema';

/**
 * Returns whether onboarding was already complete before this call. The
 * plan-selection step and the completion screen are now two separate call
 * sites for this function (picking a paid plan finishes onboarding itself
 * instead of reaching CompletionStep), so callers that need "did this just
 * complete for the first time" semantics can check the return value instead
 * of assuming every call is the first. Read-then-write, not lock-protected -
 * a best-effort guard against sequential double-calls (back button, retry),
 * not concurrent ones.
 */
export async function completeOnboarding(
  db: typeof sharedDb,
  userId: string,
  name?: string
): Promise<boolean> {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });
  const wasAlreadyComplete = existing?.onboardingComplete ?? false;

  await db
    .update(users)
    .set({
      onboardingComplete: true,
      ...(name ? { name } : {}),
      updatedAt: new Date()
    })
    .where(eq(users.id, userId));

  return wasAlreadyComplete;
}
