import type { SubscriptionStatus } from '@/lib/db/schema';

type WithStatus = { status: SubscriptionStatus | null } | null;

export const isSubscriptionActive = (sub: WithStatus): boolean =>
  sub?.status === 'active' || sub?.status === 'trialing';
