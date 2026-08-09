import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { payments, purchases, subscriptions, users } from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makePurchase, makeSubscription, makeUser } from '@/test/fixtures';
import { routeStripeEvent } from './stripe.server';
import {
  makeCharge,
  makeDispute,
  makeInvoice,
  makeStripeSub
} from './stripe-test-fixtures';

const makePaidInvoice = (customerId: string) =>
  ({
    id: 'in_route',
    customer: customerId,
    amount_paid: 2900,
    currency: 'usd',
    created: Math.floor(Date.now() / 1000),
    lines: { data: [{ pricing: { price_details: { price: 'price_x' } } }] }
  }) as unknown as Stripe.Invoice;

// ---------------------------------------------------------------------------
// routeStripeEvent
// ---------------------------------------------------------------------------

describe('routeStripeEvent', () => {
  const makeEvent = (type: string, object: unknown) =>
    ({ type, data: { object } }) as unknown as Stripe.Event;

  it('routes checkout.session.completed to handleCheckoutCompleted', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ credits: 10 });
    await db.insert(users).values(user);

    await routeStripeEvent(
      makeEvent('checkout.session.completed', {
        metadata: { userId: user.id, kind: 'credits', amount: '50' },
        customer: 'cus_test',
        payment_intent: 'pi_route_1',
        line_items: null,
        amount_total: 500,
        currency: 'usd'
      }),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.credits).toBe(60);
  });

  it('replay: routing the same event twice does not double-apply the handler effect', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ credits: 10 });
    await db.insert(users).values(user);

    const event = makeEvent('checkout.session.completed', {
      metadata: { userId: user.id, kind: 'credits', amount: '50' },
      customer: 'cus_test',
      payment_intent: 'pi_route_replay',
      line_items: null,
      amount_total: 500,
      currency: 'usd'
    });

    await routeStripeEvent(event, db);
    await routeStripeEvent(event, db);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.credits).toBe(60); // 10 + 50, only once, not 110
  });

  it('routes customer.subscription.updated to handleSubscriptionUpdate when billing.mode is subscription', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_route',
        plan: 'pro',
        status: 'active'
      })
    );

    await routeStripeEvent(
      makeEvent(
        'customer.subscription.updated',
        makeStripeSub('cus_route', 'canceled')
      ),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
  });

  it('routes customer.subscription.deleted to handleSubscriptionDeleted', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_route_del',
        plan: 'pro',
        status: 'active'
      })
    );

    await routeStripeEvent(
      makeEvent(
        'customer.subscription.deleted',
        makeStripeSub('cus_route_del', 'canceled')
      ),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub?.status).toBe('canceled');
  });

  it('does not route subscription events when billing.mode is not subscription', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_route2',
        plan: 'pro',
        status: 'active'
      })
    );

    await routeStripeEvent(
      makeEvent(
        'customer.subscription.deleted',
        makeStripeSub('cus_route2', 'canceled')
      ),
      db,
      'one_time'
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(true); // untouched - mode guard short-circuited
  });

  it('routes invoice.payment_failed to handlePaymentFailed', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_route3',
        plan: 'pro',
        status: 'active'
      })
    );

    await routeStripeEvent(
      makeEvent('invoice.payment_failed', makeInvoice('cus_route3')),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
  });

  it('routes invoice.paid to handleInvoicePaid', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        stripeCustomerId: 'cus_route_paid',
        plan: 'pro',
        status: 'active'
      })
    );

    await routeStripeEvent(
      makeEvent('invoice.paid', makePaidInvoice('cus_route_paid')),
      db
    );

    const rows = await db.select().from(payments);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(user.id);
  });

  it('routes charge.refunded to handleChargeRefunded', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ credits: 50 });
    await db.insert(users).values(user);
    await db.insert(purchases).values(
      makePurchase(user.id, {
        id: 'purchase_route',
        stripePaymentIntentId: 'pi_route_refund',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_credits',
        amount: 500,
        creditsGranted: 20
      })
    );

    await routeStripeEvent(
      makeEvent(
        'charge.refunded',
        makeCharge({ paymentIntentId: 'pi_route_refund' })
      ),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.credits).toBe(30);
  });

  it('routes charge.dispute.created to handleChargeDisputeCreated', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: true });
    await db.insert(users).values(user);
    await db.insert(purchases).values(
      makePurchase(user.id, {
        id: 'purchase_route2',
        stripePaymentIntentId: 'pi_route_dispute',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_lifetime',
        amount: 9900
      })
    );

    await routeStripeEvent(
      makeEvent(
        'charge.dispute.created',
        makeDispute({ paymentIntentId: 'pi_route_dispute' })
      ),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
  });

  it('ignores unrecognized event types', async () => {
    const db = makeTestSharedDb();
    await expect(
      routeStripeEvent(makeEvent('customer.created', {}), db)
    ).resolves.toBeUndefined();
  });
});
