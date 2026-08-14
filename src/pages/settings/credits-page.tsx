import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import { useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { config } from '@/config';
import { buyCreditsCheckoutFn, creditsQueryOptions } from '@/features/credits';
import { creditsQueryKey } from '@/lib/query-keys';

export function CreditsPage({ success }: { success: boolean }) {
  const { data: credits } = useSuspenseQuery(creditsQueryOptions);
  const queryClient = useQueryClient();
  const toast = useToast();

  // Reacting to arrival with a `success` query param (a completed Stripe
  // checkout redirect), not fetching data - the exception the coding
  // skill's "Avoid useEffect" section carves out for one-shot side effects
  // on arrival, same category as checkout.resume.tsx's mount effect.
  useEffect(() => {
    if (!success) return;
    queryClient.invalidateQueries({ queryKey: creditsQueryKey() });
    toast.success('Credits added');
  }, [success, queryClient, toast]);

  const handleBuy = async () => {
    const result = await buyCreditsCheckoutFn({ data: {} });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    window.location.href = result.data.url;
  };

  const topUpConfigured = Boolean(config.credits.topUpPriceId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Credits</h3>
        <p className="text-sm text-muted-foreground">
          Credits are consumed per metered operation (e.g. AI calls).
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{credits}</p>
            <p className="text-sm text-muted-foreground">credits remaining</p>
          </div>
        </div>

        {credits === 0 && (
          <p className="mt-4 text-sm text-destructive">
            No credits left. Top up to continue using metered features.
          </p>
        )}

        {credits > 0 && credits <= 3 && (
          <p className="mt-4 text-sm text-warning">
            Running low. Top up soon to avoid interruptions.
          </p>
        )}
      </div>

      {topUpConfigured ? (
        <div className="rounded-lg border p-6">
          <h4 className="mb-1 font-medium">Buy more credits</h4>
          <p className="mb-4 text-sm text-muted-foreground">
            Get {config.credits.creditsPerTopUp} credits added to your account
            instantly.
          </p>
          <button
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            onClick={handleBuy}
            type="button"
          >
            Buy {config.credits.creditsPerTopUp} credits
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Top-up not configured</p>
          <p className="mt-1">
            Set{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              VITE_STRIPE_CREDITS_PRICE_ID
            </code>{' '}
            and{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              config.credits.creditsPerTopUp
            </code>{' '}
            to enable credit purchases.
          </p>
        </div>
      )}
    </div>
  );
}
