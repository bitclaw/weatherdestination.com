import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '@/config';
import { getAppUrl } from '@/lib/app-url';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { hasUsedTrialBefore } from '@/lib/operations/trial-abuse.server';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import { resolveTrialDays } from './billing.server';
import { handleCheckoutCompleted } from './stripe-checkout.server';
import { stripe } from './stripe-shared.server';

// Two tiers per limiter, same reasoning as admin.mutations.ts's
// requireRateLimitedAdmin: the IP-keyed tier gates before requireUser()
// runs; the user-keyed tier gates after, so a shared NAT/proxy can't let
// one user exhaust another's budget.
const checkoutLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const userCheckoutLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const portalLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const userPortalLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
// Higher ceiling than the checkout/portal limiters above - this one is
// called on every 3s useBillingPoll tick after a real checkout (~10 ticks
// per 30s poll window), not just once per user action.
const syncLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
const userSyncLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export const createCheckoutSessionFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      priceId: z.string().min(1).max(100),
      interval: z.enum(['monthly', 'yearly'])
    })
  )
  .handler(async ({ data }) => {
    if (checkoutLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (userCheckoutLimiter.check(user.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');

    const validPriceIds = config.stripe.plans
      .flatMap(p => [p.recurring?.priceId, p.recurring?.yearlyPriceId])
      .filter((id): id is string => Boolean(id));
    if (!validPriceIds.includes(data.priceId))
      return err(ERROR_CODES.VALIDATION_ERROR, 'Invalid price');

    const appUrl = getAppUrl();

    const existing = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });

    const customerId = existing?.stripeCustomerId ?? undefined;
    let usedTrialBefore: boolean;
    try {
      usedTrialBefore = await hasUsedTrialBefore(user.email);
    } catch {
      return err(ERROR_CODES.INTERNAL, 'Failed to start checkout');
    }
    const trialDays = resolveTrialDays(
      config.billing.trialDays,
      usedTrialBefore
    );
    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: data.priceId, quantity: 1 }],
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        allow_promotion_codes: true,
        metadata: { userId: user.id, kind: 'subscription' },
        success_url: `${appUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/billing?canceled=true`,
        ...(trialDays
          ? { subscription_data: { trial_period_days: trialDays } }
          : {}),
        ...(trialDays && config.billing.noCardTrial
          ? { payment_method_collection: 'if_required' }
          : {})
      });
    } catch (error: unknown) {
      return err(
        ERROR_CODES.STRIPE_ERROR,
        error instanceof Error ? error.message : 'Stripe request failed'
      );
    }

    if (!session.url)
      return err(ERROR_CODES.STRIPE_ERROR, 'No checkout URL returned');
    return ok({ url: session.url });
  });

export const createOneTimeCheckoutFn = createServerFn({ method: 'POST' })
  .validator(z.object({ priceId: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    if (checkoutLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (userCheckoutLimiter.check(user.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');

    const validPriceIds = config.stripe.plans
      .map(p => p.oneTime?.priceId)
      .filter((id): id is string => Boolean(id));
    if (!validPriceIds.includes(data.priceId))
      return err(ERROR_CODES.VALIDATION_ERROR, 'Invalid price');

    const appUrl = getAppUrl();

    const existing = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    const customerId = existing?.stripeCustomerId ?? undefined;

    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: data.priceId, quantity: 1 }],
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        allow_promotion_codes: true,
        metadata: { userId: user.id, kind: 'one_time', priceId: data.priceId },
        success_url: `${appUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/billing?canceled=true`
      });
    } catch (error: unknown) {
      return err(
        ERROR_CODES.STRIPE_ERROR,
        error instanceof Error ? error.message : 'Stripe request failed'
      );
    }

    if (!session.url)
      return err(ERROR_CODES.STRIPE_ERROR, 'No checkout URL returned');
    return ok({ url: session.url });
  });

export const createBillingPortalFn = createServerFn({ method: 'POST' })
  .validator(z.object({}).strict())
  .handler(async () => {
    if (portalLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (userPortalLimiter.check(user.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    const customerId = sub?.stripeCustomerId ?? undefined;
    if (!customerId)
      return err(ERROR_CODES.NO_SUBSCRIPTION, 'No active subscription found');

    const appUrl = getAppUrl();
    let portal: Awaited<
      ReturnType<typeof stripe.billingPortal.sessions.create>
    >;
    try {
      portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/billing`
      });
    } catch (error: unknown) {
      return err(
        ERROR_CODES.STRIPE_ERROR,
        error instanceof Error ? error.message : 'Stripe request failed'
      );
    }

    return ok({ url: portal.url });
  });

// Active reconciliation, called on each useBillingPoll tick after a
// checkout redirect: reuses the exact same handleCheckoutCompleted the
// Stripe webhook calls (already idempotent - see
// docs/warpkit/patterns/webhook-replay.md), so there's one code path that
// ever applies a checkout session to the DB, not two that could drift.
// Closes the gap where a delayed webhook left the billing page stuck on
// "Payment processing…" until a manual reload.
export const syncCheckoutSessionFn = createServerFn({ method: 'POST' })
  .validator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    if (syncLimiter.check())
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    if (userSyncLimiter.check(user.id))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');

    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>;
    try {
      session = await stripe.checkout.sessions.retrieve(data.sessionId);
    } catch {
      return ok({ synced: false });
    }

    // A session belongs to whoever's userId is in its own metadata, not
    // whoever happens to know the session_id - same shape as the workspace
    // ownership check this pattern is ported from.
    if (session.metadata?.userId !== user.id) {
      return ok({ synced: false });
    }

    await handleCheckoutCompleted(session, db);
    return ok({ synced: true });
  });
