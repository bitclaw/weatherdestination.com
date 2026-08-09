import { randomUUIDv7 } from 'bun';
import type { purchases, subscriptions, users } from '@/lib/db/schema';

export const makeUser = (
  override?: Partial<typeof users.$inferInsert>
): typeof users.$inferInsert => {
  const now = new Date();
  return {
    id: randomUUIDv7(),
    name: 'Test User',
    email: `test-${randomUUIDv7()}@example.com`,
    emailVerified: false,
    hasAccess: false,
    onboardingComplete: false,
    createdAt: now,
    updatedAt: now,
    ...override
  };
};

export const makeSubscription = (
  userId: string,
  override?: Partial<typeof subscriptions.$inferInsert>
): typeof subscriptions.$inferInsert => {
  const now = new Date();
  return {
    id: randomUUIDv7(),
    userId,
    plan: 'free',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...override
  };
};

export const makePurchase = (
  userId: string,
  override?: Partial<typeof purchases.$inferInsert>
): typeof purchases.$inferInsert => ({
  id: randomUUIDv7(),
  userId,
  stripePaymentIntentId: `pi_${randomUUIDv7()}`,
  stripeCustomerId: null,
  stripePriceId: 'price_test',
  amount: 19900,
  currency: 'usd',
  createdAt: new Date(),
  ...override
});
