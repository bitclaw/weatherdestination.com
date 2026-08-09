import type { PlanKey, PlanLimits } from '@/config';
import { config } from '@/config';

export type { PlanKey };
export type EntitlementResource = keyof PlanLimits;

export type EntitlementResult = {
  allowed: boolean;
  used: number;
  limit: number;
};

export const getPlanLimits = (plan: PlanKey): PlanLimits =>
  config.stripe.limits[plan];

export const checkEntitlement = (
  plan: PlanKey,
  resource: EntitlementResource,
  count: number
): EntitlementResult => {
  const limit = getPlanLimits(plan)[resource];
  return { allowed: limit === -1 || count < limit, used: count, limit };
};
