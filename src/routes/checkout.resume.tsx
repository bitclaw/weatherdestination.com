import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import {
  createCheckoutSessionFn,
  createOneTimeCheckoutFn
} from '@/features/billing';
import { PATHS } from '@/lib/constants';
import { bootstrapQueryOptions } from '@/server/functions';

// Where CheckoutButton sends an unauthenticated visitor after they log in.
// Without this, a forced login->dashboard redirect silently drops the
// original "buy" intent - the visitor lands on the dashboard having never
// seen a Stripe checkout page.
const searchSchema = z.object({
  priceId: z.string().min(1),
  mode: z.enum(['subscription', 'one_time']),
  interval: z.enum(['monthly', 'yearly']).default('monthly')
});

export const Route = createFileRoute('/checkout/resume')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, location }) => {
    const result = await context.queryClient.ensureQueryData(
      bootstrapQueryOptions
    );
    if (!result.ok || !result.data.user) {
      throw redirect({
        to: PATHS.LOGIN,
        search: { redirect: location.href }
      });
    }
  },
  component: CheckoutResumePage
});

function CheckoutResumePage() {
  const { priceId, mode, interval } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);

  // Fires once on mount with the search params this route was loaded with,
  // which never change without a full navigation to this route.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional run-once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result =
        mode === 'one_time'
          ? await createOneTimeCheckoutFn({ data: { priceId } })
          : await createCheckoutSessionFn({ data: { priceId, interval } });

      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      window.location.href = result.data.url;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-muted-foreground max-w-sm text-sm">{error}</p>
        <Link
          className="text-primary text-sm font-medium hover:underline"
          to="/pricing"
        >
          Back to pricing
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <p className="text-muted-foreground text-sm">Continuing to checkout...</p>
    </div>
  );
}
