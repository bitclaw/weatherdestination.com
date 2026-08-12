import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { PlanStep } from '@/components/onboarding';
import { FormField } from '@/components/ui/form-field';
import { config } from '@/config';
import { createCheckoutSessionFn } from '@/features/billing';
import { ERROR_CODES, PATHS } from '@/lib/constants';
import { bootstrapQueryKey } from '@/lib/query-keys';
import {
  bootstrapQueryOptions,
  completeOnboardingFn
} from '@/server/functions';

// Onboarding's own plan-selection step only handles recurring/subscription
// plans (createCheckoutSessionFn's interval param assumes a subscription) -
// skip straight to the completion step for a one_time-billing-mode config,
// which has nothing for this step to offer.
const hasRecurringPlans = config.stripe.plans.some(p => p.recurring);

export const Route = createFileRoute('/onboarding')({
  loader: async ({ context }) => {
    const result = await context.queryClient.ensureQueryData(
      bootstrapQueryOptions
    );
    if (!result.ok) {
      if (result.code === ERROR_CODES.ACCOUNT_DELETION_PENDING)
        throw redirect({ to: '/account-deleting' });
      throw new Error(result.message);
    }
    if (!result.data.user) throw redirect({ to: PATHS.LOGIN });
    if (result.data.onboardingComplete) throw redirect({ to: PATHS.DASHBOARD });
    return { user: result.data.user };
  },
  component: OnboardingPage
});

function OnboardingPage() {
  const { user } = Route.useLoaderData();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: user.name ?? '' },
    onSubmit: ({ value }) => {
      setStep(hasRecurringPlans ? 2 : 3);
      return Promise.resolve(value);
    }
  });

  // Picking a paid plan redirects to Stripe and never reaches the
  // completion step, so this call site marks onboarding complete itself -
  // checkout session created first, completeOnboarding only after it
  // actually succeeds, so a failed checkout doesn't leave onboarding
  // falsely marked done right before a failed redirect strands the user.
  const handlePlanSelect = async (
    planId: string,
    priceId: string,
    interval: 'monthly' | 'yearly'
  ) => {
    setSubmitError(null);
    setPlanLoading(planId);
    try {
      const checkoutResult = await createCheckoutSessionFn({
        data: { priceId, interval }
      });
      if (!checkoutResult.ok) {
        setSubmitError(checkoutResult.message);
        return;
      }

      const completeResult = await completeOnboardingFn({
        data: { name: form.getFieldValue('name').trim() || undefined }
      });
      if (!completeResult.ok) {
        setSubmitError(completeResult.message);
        return;
      }

      window.location.href = checkoutResult.data.url;
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setPlanLoading(null);
    }
  };

  const handleComplete = async () => {
    setSubmitError(null);
    try {
      const result = await completeOnboardingFn({
        data: { name: form.getFieldValue('name').trim() || undefined }
      });
      if (!result.ok) {
        setSubmitError(result.message);
        return;
      }
      await queryClient.refetchQueries({
        queryKey: bootstrapQueryKey()
      });
      await router.navigate({ to: PATHS.DASHBOARD, replace: true });
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">{config.appName}</h1>
          <div className="flex justify-center gap-2 mt-4">
            {(hasRecurringPlans ? [1, 2, 3] : [1, 3]).map(s => (
              <div
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  s <= step ? 'bg-primary' : 'bg-muted'
                }`}
                key={s}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {step === 1 && (
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                form.handleSubmit();
              }}
            >
              <div>
                <h2 className="text-xl font-semibold">Welcome!</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Let's get you set up. What should we call you?
                </p>
              </div>

              <form.Field
                name="name"
                validators={{ onChange: z.string().max(100) }}
              >
                {field => (
                  <FormField
                    error={field.state.meta.errors[0]?.toString()}
                    htmlFor="name"
                    label="Display name"
                    optional
                  >
                    <input
                      // biome-ignore lint/a11y/noAutofocus: first field on a dedicated onboarding page
                      autoFocus
                      className="border-input bg-background ring-offset-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      id="name"
                      onBlur={field.handleBlur}
                      onChange={e => field.handleChange(e.target.value)}
                      placeholder="Jane Smith"
                      type="text"
                      value={field.state.value}
                    />
                  </FormField>
                )}
              </form.Field>

              <button
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2 text-sm font-medium"
                type="submit"
              >
                Continue
              </button>
            </form>
          )}

          {step === 2 && (
            <PlanStep
              error={submitError}
              loadingPlan={planLoading}
              onSelectPlan={handlePlanSelect}
              onSkip={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">You're all set!</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {form.getFieldValue('name').trim()
                    ? `Welcome, ${form.getFieldValue('name').trim()}. Your account is ready.`
                    : 'Your account is ready. You can update your profile anytime in settings.'}
                </p>
              </div>

              {submitError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {submitError}
                </div>
              )}

              <form.Subscribe selector={s => s.isSubmitting}>
                {isSubmitting => (
                  <button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                    disabled={isSubmitting}
                    onClick={handleComplete}
                    type="button"
                  >
                    {isSubmitting ? 'Setting up…' : 'Go to dashboard'}
                  </button>
                )}
              </form.Subscribe>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {user.email}
        </p>
      </div>
    </div>
  );
}
