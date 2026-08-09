import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { users } from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makeUser } from '@/test/fixtures';
import { completeOnboarding } from './onboarding.server';

describe('completeOnboarding', () => {
  it('sets onboardingComplete to true', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ onboardingComplete: false });
    await db.insert(users).values(user);

    await completeOnboarding(db, user.id);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.onboardingComplete).toBe(true);
  });

  it('updates display name when provided', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ name: 'Old Name', onboardingComplete: false });
    await db.insert(users).values(user);

    await completeOnboarding(db, user.id, 'New Name');

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.onboardingComplete).toBe(true);
    expect(updated?.name).toBe('New Name');
  });

  it('preserves existing name when not provided', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ name: 'Keep Me', onboardingComplete: false });
    await db.insert(users).values(user);

    await completeOnboarding(db, user.id);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.name).toBe('Keep Me');
  });
});
