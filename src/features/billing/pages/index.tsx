import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { ErrorBanner } from '@/components/ui/error-banner';
import { StatusBanner } from '@/components/ui/status-banner';
import type { StripePlan } from '@/config';
import { config } from '@/config';
import {
  createBillingPortalFn,
  createCheckoutSessionFn,
  createOneTimeCheckoutFn,
  type getOneTimePurchaseFn,
  type getSubscriptionFn,
  oneTimePurchaseQueryOptions,
  PlanBadge,
  subscriptionQueryOptions
} from '@/features/billing';
import type { AppRouteContext } from '@/lib/types';
import { useBillingPoll } from '../hooks/use-billing-poll';

type Props = Pick<
  AppRouteContext,
  'hasAccess' | 'plan' | 'isTrialing' | 'trialEndsAt'
> & {
  success: boolean;
  canceled: boolean;
};

export function BillingPage({
  hasAccess,
  plan,
  isTrialing,
  trialEndsAt,
  success,
  canceled
}: Props) {
  const isOneTime = config.billing.mode === 'one_time';

  if (isOneTime) {
    return (
      <OneTimeBillingPage
        canceled={canceled}
        hasAccess={hasAccess}
        success={success}
      />
    );
  }

  return (
    <SubscriptionBillingPage
      canceled={canceled}
      hasAccess={hasAccess}
      isTrialing={isTrialing}
      plan={plan}
      success={success}
      trialEndsAt={trialEndsAt}
    />
  );
}

function OneTimeBillingPage({
  hasAccess,
  success,
  canceled
}: Pick<Props, 'hasAccess' | 'success' | 'canceled'>) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: purchase } = useSuspenseQuery(oneTimePurchaseQueryOptions);
  // Settlement must come from live query data: the hasAccess prop is route
  // context, frozen for this mount, so it alone can never observe the webhook.
  const isSettled = hasAccess || purchase !== null;
  useBillingPoll({
    success,
    isSettled,
    queryClient
  });

  const handleBuyOnce = async (priceId: string) => {
    setError(null);
    setLoading(priceId);
    try {
      const result = await createOneTimeCheckoutFn({ data: { priceId } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      window.location.href = result.data.url;
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Failed to open checkout'
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main>
        <div className="space-y-6 max-w-2xl">
          <div>
            <h1 className="text-3xl font-bold">Billing</h1>
            <p className="text-muted-foreground mt-1">Manage your purchase.</p>
          </div>

          {success && !isSettled && (
            <StatusBanner variant="info">
              Payment processing… this can take a few seconds.
            </StatusBanner>
          )}

          {success && isSettled && (
            <StatusBanner variant="success">
              Purchase successful: you now have lifetime access.
            </StatusBanner>
          )}

          {canceled && (
            <StatusBanner variant="neutral">
              Checkout canceled. No charge was made.
            </StatusBanner>
          )}

          <ErrorBanner message={error} variant="error" />

          <OneTimeBillingSection
            hasAccess={hasAccess}
            loading={loading}
            onBuyOnce={handleBuyOnce}
            purchase={purchase}
          />
        </div>
      </Main>
    </>
  );
}

function SubscriptionBillingPage({
  hasAccess,
  plan,
  isTrialing,
  trialEndsAt,
  success,
  canceled
}: Pick<
  Props,
  'hasAccess' | 'plan' | 'isTrialing' | 'trialEndsAt' | 'success' | 'canceled'
>) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: sub } = useSuspenseQuery(subscriptionQueryOptions);
  // Settlement must come from live query data: the plan prop is route context,
  // frozen for this mount, so it alone can never observe the webhook.
  const livePlan = sub?.plan ?? 'free';
  const isSettled = plan !== 'free' || livePlan !== 'free';
  useBillingPoll({
    success,
    isSettled,
    queryClient
  });

  const handleManage = async () => {
    setError(null);
    setLoading('manage');
    try {
      const result = await createBillingPortalFn({ data: {} });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      window.location.href = result.data.url;
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Failed to open billing portal'
      );
    } finally {
      setLoading(null);
    }
  };

  const handleUpgrade = async (priceId: string) => {
    setError(null);
    setLoading(priceId);
    try {
      const result = await createCheckoutSessionFn({
        data: { priceId, interval: 'monthly' }
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      window.location.href = result.data.url;
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Failed to open checkout'
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main>
        <div className="space-y-6 max-w-2xl">
          <div>
            <h1 className="text-3xl font-bold">Billing</h1>
            <p className="text-muted-foreground mt-1">
              Manage your subscription.
            </p>
          </div>

          {success && !isSettled && (
            <StatusBanner variant="info">
              Payment processing… this can take a few seconds.
            </StatusBanner>
          )}

          {success && isSettled && (
            <StatusBanner variant="success">
              Payment successful: your Pro access is now active.
            </StatusBanner>
          )}

          {canceled && (
            <StatusBanner variant="neutral">
              Checkout canceled. No charge was made.
            </StatusBanner>
          )}

          <ErrorBanner message={error} variant="error" />

          <SubscriptionBillingSection
            hasAccess={hasAccess}
            isTrialing={isTrialing}
            loading={loading}
            onManage={handleManage}
            onUpgrade={handleUpgrade}
            plan={plan}
            sub={sub}
            trialEndsAt={trialEndsAt}
          />
        </div>
      </Main>
    </>
  );
}

type PurchaseRow = NonNullable<
  Extract<
    Awaited<ReturnType<typeof getOneTimePurchaseFn>>,
    { ok: true }
  >['data']
>;

function OneTimeBillingSection({
  hasAccess,
  loading,
  purchase,
  onBuyOnce
}: {
  hasAccess: boolean;
  loading: string | null;
  purchase: PurchaseRow | null;
  onBuyOnce: (priceId: string) => void;
}) {
  if (hasAccess && purchase) {
    return (
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">Access</p>
          <span className="rounded-full bg-success/10 px-3 py-0.5 text-xs font-semibold text-success">
            Lifetime
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Purchased{' '}
          {purchase.createdAt.toLocaleDateString('en-US', { timeZone: 'UTC' })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Get access</h2>
      <div className="grid gap-3">
        {config.stripe.plans.map((p: StripePlan) =>
          p.oneTime ? (
            <div className="rounded-lg border p-4 space-y-3" key={p.name}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-muted-foreground text-sm">
                    ${p.oneTime.price} one-time
                  </p>
                </div>
                <button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                  disabled={loading === p.oneTime!.priceId}
                  onClick={() => onBuyOnce(p.oneTime!.priceId)}
                  type="button"
                >
                  {loading === p.oneTime!.priceId ? 'Loading...' : 'Buy once'}
                </button>
              </div>
              <ul className="space-y-1">
                {p.features.map(f => (
                  <li
                    className="text-sm text-muted-foreground flex gap-2"
                    key={f}
                  >
                    <span className="text-success">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

type SubRow = NonNullable<
  Extract<Awaited<ReturnType<typeof getSubscriptionFn>>, { ok: true }>['data']
>;

function SubscriptionBillingSection({
  hasAccess,
  isTrialing,
  loading,
  plan,
  sub,
  trialEndsAt,
  onManage,
  onUpgrade
}: {
  hasAccess: boolean;
  isTrialing: boolean;
  loading: string | null;
  plan: AppRouteContext['plan'];
  sub: SubRow | null;
  trialEndsAt: Date | null;
  onManage: () => void;
  onUpgrade: (priceId: string) => void;
}) {
  return (
    <>
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Current plan</p>
            {sub?.currentPeriodEnd && !isTrialing && (
              <p className="text-muted-foreground text-sm mt-0.5">
                Renews{' '}
                {sub.currentPeriodEnd.toLocaleDateString('en-US', {
                  timeZone: 'UTC'
                })}
              </p>
            )}
            {isTrialing && trialEndsAt && (
              <p className="text-muted-foreground text-sm mt-0.5">
                Trial ends{' '}
                {trialEndsAt.toLocaleDateString('en-US', { timeZone: 'UTC' })}.
                No charge until after trial.
              </p>
            )}
          </div>
          <PlanBadge isTrialing={isTrialing} plan={plan} />
        </div>
        {hasAccess && (
          <button
            className="border-input bg-background hover:bg-accent rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            disabled={loading === 'manage'}
            onClick={onManage}
            type="button"
          >
            {loading === 'manage' ? 'Opening...' : 'Manage subscription'}
          </button>
        )}
      </div>

      {!hasAccess && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Upgrade</h2>
          <div className="grid gap-3">
            {config.stripe.plans.map((p: StripePlan) =>
              p.recurring ? (
                <div className="rounded-lg border p-4 space-y-3" key={p.name}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-muted-foreground text-sm">
                        ${p.recurring.price}/mo
                        {p.recurring.yearlyPrice
                          ? ` · $${p.recurring.yearlyPrice}/yr`
                          : ''}
                      </p>
                    </div>
                    <button
                      className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                      disabled={loading === p.recurring!.priceId}
                      onClick={() => onUpgrade(p.recurring!.priceId)}
                      type="button"
                    >
                      {loading === p.recurring!.priceId
                        ? 'Loading...'
                        : 'Upgrade'}
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {p.features.map(f => (
                      <li
                        className="text-sm text-muted-foreground flex gap-2"
                        key={f}
                      >
                        <span className="text-success">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </>
  );
}
