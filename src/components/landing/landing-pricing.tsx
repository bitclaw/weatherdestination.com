import { Check } from 'lucide-react';
import { AnimateNumber } from 'motion-plus/react';
import { useState } from 'react';
import { BillingIntervalToggle } from '@/components/landing/billing-interval-toggle';
import { CheckoutButton } from '@/components/landing/checkout-button';
import { AnimateIn } from '@/components/ui/animate-in';
import { config } from '@/config';

// Exported for testing
export function getPricingGridClass(
  planCount: number,
  isOneTime: boolean
): string {
  if (isOneTime || planCount <= 1) return 'max-w-lg';
  if (planCount === 2) return 'max-w-3xl md:grid-cols-2';
  if (planCount === 3) return 'max-w-5xl lg:grid-cols-3';
  return 'max-w-6xl sm:grid-cols-2 lg:grid-cols-4';
}

export function LandingPricing() {
  const [isYearly, setIsYearly] = useState(false);
  const isOneTime = config.billing.mode === 'one_time';
  const trialDays =
    !isOneTime && config.billing.trialDays && config.billing.trialDays > 0
      ? config.billing.trialDays
      : null;

  return (
    <section className="px-6 py-24" id="pricing">
      <div className="mx-auto max-w-6xl">
        <AnimateIn className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground mt-4">
            {isOneTime
              ? 'One-time purchase. Lifetime access.'
              : trialDays
                ? `${trialDays}-day free trial. Cancel anytime.`
                : 'Simple pricing. Cancel anytime.'}
          </p>
          {!isOneTime && (
            <div className="mt-8">
              <BillingIntervalToggle
                isYearly={isYearly}
                onChange={setIsYearly}
              />
            </div>
          )}
        </AnimateIn>

        <div
          className={`mx-auto mt-16 grid gap-8 ${getPricingGridClass(config.stripe.plans.length, isOneTime)}`}
        >
          {/* Plans from config */}
          {config.stripe.plans.map((plan, i) => {
            const displayPrice = isOneTime
              ? (plan.oneTime?.price ?? 0)
              : isYearly
                ? (plan.recurring?.yearlyPrice ?? 0)
                : (plan.recurring?.price ?? 0);
            const suffix = isOneTime ? 'one-time' : isYearly ? '/yr' : '/mo';
            const equivalentMonthly =
              !isOneTime && isYearly && plan.recurring?.yearlyPrice
                ? (plan.recurring.yearlyPrice / 12).toFixed(0)
                : null;

            return (
              <AnimateIn delay={0.1 + i * 0.08} key={plan.name}>
                <div
                  className={`relative h-full rounded-xl p-8 ${
                    plan.popular
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary shadow-xl scale-[1.02]'
                      : 'bg-background border'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground rounded-full border-2 border-background px-4 py-1 text-xs font-semibold shadow">
                        Most popular
                      </span>
                    </div>
                  )}

                  <h3 className="text-xl font-semibold">{plan.name}</h3>

                  <div className="mt-2 flex items-baseline gap-1">
                    <span
                      className={`text-sm font-semibold ${plan.popular ? 'opacity-80' : 'text-muted-foreground'}`}
                    >
                      $
                    </span>
                    <span className="text-4xl font-bold tabular-nums">
                      <AnimateNumber
                        aria-hidden="true"
                        transition={{
                          type: 'spring',
                          bounce: 0,
                          duration: 0.4
                        }}
                      >
                        {displayPrice}
                      </AnimateNumber>
                      <span className="sr-only">{displayPrice}</span>
                    </span>
                    <span
                      className={`text-sm ${plan.popular ? 'opacity-80' : 'text-muted-foreground'}`}
                    >
                      {suffix}
                    </span>
                  </div>

                  <p
                    className={`mt-0.5 text-xs ${plan.popular ? 'opacity-70' : 'text-muted-foreground'}`}
                  >
                    {equivalentMonthly ? (
                      `$${equivalentMonthly}/mo equivalent`
                    ) : (
                      <>&nbsp;</>
                    )}
                  </p>

                  <p
                    className={`mt-2 text-sm ${plan.popular ? 'opacity-80' : 'text-muted-foreground'}`}
                  >
                    {plan.description}
                  </p>

                  <CheckoutButton
                    className={`mt-6 w-full ${
                      plan.popular
                        ? 'bg-background text-foreground hover:bg-background/90'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                    interval={isYearly ? 'yearly' : 'monthly'}
                    mode={config.billing.mode}
                    priceId={
                      config.billing.mode === 'one_time'
                        ? (plan.oneTime?.priceId ?? '')
                        : isYearly
                          ? (plan.recurring?.yearlyPriceId ?? '')
                          : (plan.recurring?.priceId ?? '')
                    }
                  >
                    {config.billing.mode === 'one_time'
                      ? 'Buy once'
                      : trialDays
                        ? `Start ${trialDays}-day free trial`
                        : 'Get started'}
                  </CheckoutButton>

                  <ul className="mt-6 space-y-3 text-sm">
                    {plan.features.map(f => (
                      <li className="flex items-center gap-2" key={f}>
                        <Check
                          className={`h-4 w-4 shrink-0 ${plan.popular ? 'opacity-80' : 'text-primary'}`}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimateIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
