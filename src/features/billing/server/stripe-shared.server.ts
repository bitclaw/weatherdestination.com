import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { config, type PlanId, type StripePlan } from '@/config';
import type { db as sharedDb } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { stripe } from '@/lib/http-clients';

export type Db = typeof sharedDb;
export type BillingMode = 'subscription' | 'one_time';

export { stripe };

// plans injectable for tests: config.stripe.plans has empty price ids under
// bun test (import.meta.env is {}), which would make every assertion vacuous.
export const getPlanIdForPriceId = (
  priceId: string | null | undefined,
  plans: readonly StripePlan[] = config.stripe.plans
): PlanId | undefined => {
  if (priceId) {
    for (const plan of plans) {
      if (
        plan.recurring?.priceId === priceId ||
        plan.recurring?.yearlyPriceId === priceId
      ) {
        return plan.id;
      }
    }
  }
  return undefined;
};

// Stripe moved current_period_end/current_period_start off the top-level
// Subscription object onto each subscription item (to support multi-item
// subscriptions) well before the API version this client is pinned to -
// reading it at the top level always returns undefined against a real
// Stripe response, silently nulling out period tracking.
export const getPeriodEnd = (sub: Stripe.Subscription): Date | null => {
  const raw = sub.items?.data[0]?.current_period_end;
  return typeof raw === 'number' ? new Date(raw * 1000) : null;
};

export const parseTrialEnd = (
  trialEnd: number | null | undefined
): Date | null => {
  return trialEnd ? new Date(trialEnd * 1000) : null;
};

// Stripe expandable fields arrive as either a plain id string or the
// expanded object; webhook payloads are never expanded, so this is always
// the string case in production, but tests and defensive code need both.
export const unwrapId = (
  field: string | { id: string } | null | undefined
): string | null => (typeof field === 'string' ? field : (field?.id ?? null));

export const findSubscriptionByCustomerId = (db: Db, customerId: string) =>
  db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeCustomerId, customerId)
  });
