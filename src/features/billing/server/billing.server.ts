import { TTLCache } from '@bitclaw/sqlite/ttl-cache';
import { eq } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/bun-sqlite';
import { db } from '@/lib/db';
import type * as schema from '@/lib/db/schema';
import { subscriptions } from '@/lib/db/schema';

const globalForBilling = globalThis as unknown as {
  _subCache?: TTLCache<SubscriptionRow | null>;
};

type SubscriptionRow = typeof subscriptions.$inferSelect;

const subCache =
  globalForBilling._subCache ??
  new TTLCache<SubscriptionRow | null>({ ttl: 30_000, maxSize: 5000 });

if (process.env.NODE_ENV !== 'production') {
  globalForBilling._subCache = subCache;
}

export const resolveTrialDays = (
  trialDays: number | undefined,
  // A previously-deleted account re-signing up with the same email
  // shouldn't get a second free trial - see
  // src/lib/operations/trial-abuse.server.ts.
  usedTrialBefore = false
): number | undefined => {
  if (usedTrialBefore) return undefined;
  return trialDays && trialDays > 0 ? trialDays : undefined;
};

export const getCachedSubscription = async (
  userId: string,
  dbOverride?: ReturnType<typeof drizzle<typeof schema>>
): Promise<SubscriptionRow | null> => {
  const d = dbOverride ?? db;
  const cached = subCache.get(userId);
  if (cached !== undefined) return cached;
  const row = await d.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId)
  });
  const result = row ?? null;
  subCache.set(userId, result);
  return result;
};

export const invalidateSubscriptionCache = (userId: string): void => {
  subCache.delete(userId);
};
