import { eq } from 'drizzle-orm';
import type { db as sharedDb } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function completeOnboarding(
  db: typeof sharedDb,
  userId: string,
  name?: string
): Promise<void> {
  await db
    .update(users)
    .set({
      onboardingComplete: true,
      ...(name ? { name } : {}),
      updatedAt: new Date()
    })
    .where(eq(users.id, userId));
}
