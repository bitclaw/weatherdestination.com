import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '@/config';
import { stripe } from '@/features/billing/server/stripe-shared.server';
import { requireFeatureFlagEnabled } from '@/features/feature-flags/server/feature-flags.server';
import { getAppUrl } from '@/lib/app-url';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';

// Two tiers, same reasoning as admin.mutations.ts's requireRateLimitedAdmin:
// IP-keyed before requireUser() runs, user-keyed after, so a shared
// NAT/proxy can't let one user exhaust another's budget.
const creditsCheckoutLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const userCreditsCheckoutLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10
});

export const buyCreditsCheckoutFn = createServerFn({
  method: 'POST'
})
  .validator(z.object({}).strict())
  .handler(async () => {
    if (creditsCheckoutLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'credits_enabled');
    if (!flag.ok) return flag;
    if (userCreditsCheckoutLimiter.check(user.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');

    const priceId = config.credits.topUpPriceId;
    if (!priceId)
      return err(ERROR_CODES.STRIPE_ERROR, 'Credit top-up not configured');

    const appUrl = getAppUrl();

    const existing = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    const customerId = existing?.stripeCustomerId ?? undefined;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        metadata: {
          userId: user.id,
          kind: 'credits',
          amount: String(config.credits.creditsPerTopUp)
        },
        success_url: `${appUrl}/dashboard/settings/credits?success=true`,
        cancel_url: `${appUrl}/dashboard/settings/credits`
      });
      if (!session.url)
        return err(ERROR_CODES.STRIPE_ERROR, 'No checkout URL returned');
      return ok({ url: session.url });
    } catch (error: unknown) {
      return err(
        ERROR_CODES.STRIPE_ERROR,
        error instanceof Error ? error.message : 'Stripe request failed'
      );
    }
  });
