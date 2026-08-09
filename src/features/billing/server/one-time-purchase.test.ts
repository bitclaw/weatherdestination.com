import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { purchases, users } from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makePurchase, makeUser } from '@/test/fixtures';
import { handleOneTimePurchase } from './stripe-checkout.server';

const makeOneTimeSession = (
  override: Partial<{
    userId: string;
    customerId: string;
    paymentIntentId: string;
    priceId: string;
    amountTotal: number;
  }> = {}
) =>
  ({
    metadata: {
      userId: override.userId ?? '',
      kind: 'one_time',
      priceId: override.priceId ?? 'price_test'
    },
    customer: override.customerId ?? 'cus_test',
    payment_intent: override.paymentIntentId ?? 'pi_test_abc',
    line_items: null,
    amount_total: override.amountTotal ?? 19900,
    currency: 'usd'
  }) as unknown as Stripe.Checkout.Session;

// ---------------------------------------------------------------------------
// handleOneTimePurchase
// ---------------------------------------------------------------------------

describe('handleOneTimePurchase', () => {
  it('inserts purchase row and grants access', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    await handleOneTimePurchase(
      makeOneTimeSession({ userId: user.id, paymentIntentId: 'pi_new' }),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(true);

    const purchase = await db.query.purchases.findFirst({
      where: eq(purchases.userId, user.id)
    });
    expect(purchase?.stripePaymentIntentId).toBe('pi_new');
    expect(purchase?.stripePriceId).toBe('price_test');
    expect(purchase?.amount).toBe(19900);
  });

  it('replay: duplicate webhook does not create second purchase row', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    const session = makeOneTimeSession({
      userId: user.id,
      paymentIntentId: 'pi_dup'
    });

    await handleOneTimePurchase(session, db);
    await handleOneTimePurchase(session, db);

    const all = await db.select().from(purchases);
    expect(all).toHaveLength(1);
  });

  it('replay: hasAccess stays true even when row already exists', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: false });
    await db.insert(users).values(user);
    await db
      .insert(purchases)
      .values(makePurchase(user.id, { stripePaymentIntentId: 'pi_exists' }));

    await handleOneTimePurchase(
      makeOneTimeSession({ userId: user.id, paymentIntentId: 'pi_exists' }),
      db
    );

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(true);
  });

  it('no-op when metadata.userId is missing', async () => {
    const db = makeTestSharedDb();

    await handleOneTimePurchase(
      makeOneTimeSession({ userId: '', paymentIntentId: 'pi_noid' }),
      db
    );

    const all = await db.select().from(purchases);
    expect(all).toHaveLength(0);
  });

  it('no-op when payment_intent is missing', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    const session = {
      metadata: { userId: user.id, kind: 'one_time', priceId: 'price_test' },
      customer: 'cus_test',
      payment_intent: null,
      line_items: null,
      amount_total: 19900,
      currency: 'usd'
    } as unknown as Stripe.Checkout.Session;

    await handleOneTimePurchase(session, db);

    const all = await db.select().from(purchases);
    expect(all).toHaveLength(0);
  });

  it('no-op and grants no access when session metadata has no userId', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ hasAccess: false });
    await db.insert(users).values(user);

    await handleOneTimePurchase(makeOneTimeSession({ userId: '' }), db);

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(updated?.hasAccess).toBe(false);
    const all = await db.select().from(purchases);
    expect(all).toHaveLength(0);
  });
});
