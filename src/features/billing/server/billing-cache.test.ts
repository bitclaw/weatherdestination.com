import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { subscriptions, users } from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makeSubscription, makeUser } from '@/test/fixtures';
import {
  getCachedSubscription,
  invalidateSubscriptionCache
} from './billing.server';

describe('subscription cache invalidation', () => {
  it('returns null when no subscription exists, then caches', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    const result = await getCachedSubscription(user.id, db);
    expect(result).toBeNull();

    // Insert a subscription after the cache was populated with null
    await db
      .insert(subscriptions)
      .values(makeSubscription(user.id, { plan: 'pro' }));

    // Without invalidation, cached null should still return null
    const stale = await getCachedSubscription(user.id, db);
    expect(stale).toBeNull();

    // After invalidation, next read should fetch the new row
    invalidateSubscriptionCache(user.id);
    const fresh = await getCachedSubscription(user.id, db);
    expect(fresh).not.toBeNull();
    expect(fresh!.plan).toBe('pro');
  });

  it('invalidates after DB update', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db
      .insert(subscriptions)
      .values(makeSubscription(user.id, { plan: 'free', status: 'active' }));

    // First read populates cache
    const sub = await getCachedSubscription(user.id, db);
    expect(sub).not.toBeNull();

    // Change DB state and invalidate
    await db
      .update(subscriptions)
      .set({ status: 'canceled' })
      .where(eq(subscriptions.userId, user.id));
    invalidateSubscriptionCache(user.id);

    // Next read should see the updated status
    const fresh = await getCachedSubscription(user.id, db);
    expect(fresh!.status).toBe('canceled');
  });

  it('invalidating unknown userId does not throw', () => {
    expect(() => invalidateSubscriptionCache('nonexistent')).not.toThrow();
  });

  it('is idempotent', () => {
    const userId = 'test-user-id';
    invalidateSubscriptionCache(userId);
    invalidateSubscriptionCache(userId);
    expect(() => invalidateSubscriptionCache(userId)).not.toThrow();
  });
});
