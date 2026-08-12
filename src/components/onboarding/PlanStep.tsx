import { Check, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { BillingIntervalToggle } from '@/components/landing/billing-interval-toggle';
import { ErrorBanner } from '@/components/ui/error-banner';
import { config } from '@/config';
import { getTrialCopy } from '@/server/billing/plan-data';

type Props = {
  onSelectPlan: (
    planId: string,
    priceId: string,
    interval: 'monthly' | 'yearly'
  ) => void;
  onSkip: () => void;
  error?: string | null;
  /** Plan id currently submitting, or null. */
  loadingPlan?: string | null;
};

const recurringPlans = config.stripe.plans.filter(p => p.recurring);
const trialCopy = getTrialCopy(config.billing);

export function PlanStep({ onSelectPlan, onSkip, error, loadingPlan }: Props) {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Choose a plan</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick the plan that fits, or decide later.
        </p>
      </div>

      <ErrorBanner message={error ?? null} />

      <div className="flex justify-center">
        <BillingIntervalToggle isYearly={isYearly} onChange={setIsYearly} />
      </div>

      <div className="space-y-3">
        {recurringPlans.map(plan => {
          const price = isYearly
            ? (plan.recurring?.yearlyPrice ?? (plan.recurring?.price ?? 0) * 10)
            : (plan.recurring?.price ?? 0);
          const priceId = isYearly
            ? plan.recurring?.yearlyPriceId
            : plan.recurring?.priceId;
          const isLoading = loadingPlan === plan.id;

          return (
            <button
              className={`w-full rounded-lg border p-4 text-left transition-colors disabled:opacity-50 ${
                plan.popular
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
              disabled={!!loadingPlan || !priceId}
              key={plan.id}
              onClick={() => {
                if (priceId)
                  onSelectPlan(
                    plan.id,
                    priceId,
                    isYearly ? 'yearly' : 'monthly'
                  );
              }}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{plan.name}</span>
                    {plan.popular && (
                      <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {plan.description}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold">
                    ${price}
                    <span className="text-muted-foreground text-xs font-normal">
                      /{isYearly ? 'yr' : 'mo'}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {isLoading ? 'Redirecting…' : 'Select'}
                  </div>
                </div>
              </div>
              {plan.features.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {plan.features.map(feature => (
                    <li
                      className="text-muted-foreground flex items-center gap-1.5 text-xs"
                      key={feature}
                    >
                      <Check className="h-3 w-3 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      {trialCopy && (
        <p className="text-muted-foreground text-center text-xs">
          {trialCopy.sentence}
        </p>
      )}

      <button
        className="text-muted-foreground w-full text-center text-sm hover:underline disabled:opacity-50"
        disabled={!!loadingPlan}
        onClick={onSkip}
        type="button"
      >
        Skip for now
      </button>
    </div>
  );
}
