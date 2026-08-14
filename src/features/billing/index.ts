import { queryOptions } from '@tanstack/react-query';
import {
  oneTimePurchaseQueryKey,
  subscriptionQueryKey
} from '@/lib/query-keys';
import {
  getOneTimePurchaseFn,
  getSubscriptionFn
} from './server/billing.queries';

export { EntitlementGate } from './components/EntitlementGate';
export { PlanBadge } from './components/PlanBadge';
export { UpgradeGate } from './components/UpgradeGate';
export {
  createBillingPortalFn,
  createCheckoutSessionFn,
  createOneTimeCheckoutFn,
  syncCheckoutSessionFn
} from './server/billing.mutations';
export {
  getOneTimePurchaseFn,
  getSubscriptionFn
} from './server/billing.queries';

export const subscriptionQueryOptions = queryOptions({
  queryKey: subscriptionQueryKey(),
  queryFn: async () => {
    const result = await getSubscriptionFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 60_000
});

export const oneTimePurchaseQueryOptions = queryOptions({
  queryKey: oneTimePurchaseQueryKey(),
  queryFn: async () => {
    const result = await getOneTimePurchaseFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 60_000
});
