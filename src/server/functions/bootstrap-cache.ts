import { TTLCache } from '@bitclaw/server-kit/ttl-cache';
import type { PlanKey } from '@/config';

// Split from bootstrap.ts so server-side mutations (webhook handlers, admin,
// onboarding) can invalidate the cache without importing the createServerFn /
// react-query machinery that bootstrap.ts pulls in.
export type BootstrapPayload = {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  } | null;
  hasAccess: boolean;
  plan: PlanKey;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  isAdmin: boolean;
  onboardingComplete: boolean;
  credits: number;
};

export const bootstrapCache = new TTLCache<BootstrapPayload>({
  ttl: 10_000,
  maxSize: 5000
});

// Call after any shared-DB write that changes bootstrap-visible state
// (hasAccess, plan, trial, credits, onboardingComplete) , otherwise the client
// refetch returns the stale cached payload for up to the 10s TTL.
export const invalidateBootstrapCache = (userId: string): void => {
  bootstrapCache.delete(userId);
};
