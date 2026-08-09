import type { StripePlan } from '@/config';

export const resolveReceiptPlanName = (
  plans: StripePlan[],
  priceId: string | null | undefined
): string => {
  if (priceId) {
    for (const plan of plans) {
      if (
        plan.recurring?.priceId === priceId ||
        plan.recurring?.yearlyPriceId === priceId ||
        plan.oneTime?.priceId === priceId
      ) {
        return plan.name;
      }
    }
  }
  return plans[0]?.name ?? 'Pro';
};
