import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { HttpResponse, http } from 'msw';
import {
  handleSubscriptionDeleted,
  handleSubscriptionUpdate
} from '@/features/billing/server/stripe-subscription.server';
import { subscriptions, users } from '@/lib/db/schema';
import { reconcileBillingSubscriptions } from '@/lib/operations/billing-reconciliation.server';
import { makeTestSharedDb } from '@/test/db';
import { makeSubscription, makeUser } from '@/test/fixtures';
import { mswServer } from '@/test/msw/server';

type Db = ReturnType<typeof makeTestSharedDb>;

const insertUser = async (
  db: Db,
  override?: Partial<typeof users.$inferInsert>
) => {
  const user = makeUser(override);
  await db.insert(users).values(user);
  return user;
};

const insertSubscription = async (
  db: Db,
  userId: string,
  override?: Partial<typeof subscriptions.$inferInsert>
) => {
  const sub = makeSubscription(userId, override);
  await db.insert(subscriptions).values(sub);
  return sub;
};

const makeStripeSubResponse = (
  id: string,
  status: string,
  periodEndOffset = 30 * 86400,
  extra: Record<string, unknown> = {}
) => ({
  id,
  object: 'subscription',
  status,
  customer: 'cus_test',
  // current_period_end lives on the subscription item, not the top-level
  // object, in the API version this app targets - matches getPeriodEnd.
  items: {
    data: [
      {
        price: { id: 'price_test' },
        current_period_end: Math.floor(Date.now() / 1000) + periodEndOffset
      }
    ]
  },
  ...extra
});

describe('reconcileBillingSubscriptions - active subscription stays active', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('sets lastSyncedAt and currentPeriodEnd, no access change', async () => {
    const user = await insertUser(db, { hasAccess: true });
    await insertSubscription(db, user.id, {
      stripeSubscriptionId: 'sub_active',
      stripeCustomerId: 'cus_test',
      status: 'active',
      plan: 'pro'
    });

    const { synced, errors } = await reconcileBillingSubscriptions(db);
    expect(synced).toBe(1);
    expect(errors).toBe(0);

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub!.lastSyncedAt).not.toBeNull();
    expect(sub!.currentPeriodEnd).not.toBeNull();
    expect(sub!.status).toBe('active');
    expect(sub!.plan).toBe('free');

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(dbUser!.hasAccess).toBe(true);
  });
});

describe('reconcileBillingSubscriptions - drift correction', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('DB active, Stripe past_due: updates status/plan, revokes access', async () => {
    const user = await insertUser(db, { hasAccess: true });
    await insertSubscription(db, user.id, {
      stripeSubscriptionId: 'sub_past_due',
      stripeCustomerId: 'cus_test',
      status: 'active',
      plan: 'pro'
    });

    mswServer.use(
      http.get('https://api.stripe.com/v1/subscriptions/:id', ({ params }) =>
        HttpResponse.json(
          makeStripeSubResponse(params.id as string, 'past_due')
        )
      )
    );

    await reconcileBillingSubscriptions(db);

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub!.status).toBe('past_due');
    expect(sub!.plan).toBe('free');
    expect(sub!.lastSyncedAt).not.toBeNull();

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(dbUser!.hasAccess).toBe(false);
  });

  it('DB active, Stripe canceled: updates status, revokes access', async () => {
    const user = await insertUser(db, { hasAccess: true });
    await insertSubscription(db, user.id, {
      stripeSubscriptionId: 'sub_canceled',
      stripeCustomerId: 'cus_test',
      status: 'active',
      plan: 'pro'
    });

    mswServer.use(
      http.get('https://api.stripe.com/v1/subscriptions/:id', ({ params }) =>
        HttpResponse.json({
          ...makeStripeSubResponse(params.id as string, 'canceled'),
          current_period_end: null
        })
      )
    );

    await reconcileBillingSubscriptions(db);

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub!.status).toBe('canceled');
    expect(sub!.plan).toBe('free');

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(dbUser!.hasAccess).toBe(false);
  });
});

describe('reconcileBillingSubscriptions - resource_missing', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('Stripe resource_missing: treats as deleted, revokes access', async () => {
    const user = await insertUser(db, { hasAccess: true });
    await insertSubscription(db, user.id, {
      stripeSubscriptionId: 'sub_gone',
      stripeCustomerId: 'cus_test',
      status: 'active',
      plan: 'pro'
    });

    mswServer.use(
      http.get('https://api.stripe.com/v1/subscriptions/:id', () =>
        HttpResponse.json(
          {
            error: { code: 'resource_missing', message: 'No such subscription' }
          },
          { status: 404 }
        )
      )
    );

    const { synced, errors } = await reconcileBillingSubscriptions(db);
    expect(synced).toBe(1);
    expect(errors).toBe(0);

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub!.status).toBe('canceled');
    expect(sub!.plan).toBe('free');
    expect(sub!.currentPeriodEnd).toBeNull();
    expect(sub!.lastSyncedAt).not.toBeNull();

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(dbUser!.hasAccess).toBe(false);
  });
});

describe('reconcileBillingSubscriptions - Stripe 503 partial failure', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('error logged, other subs processed; returns correct counts', async () => {
    const user1 = await insertUser(db, { hasAccess: true });
    const user2 = await insertUser(db, { hasAccess: true });

    await insertSubscription(db, user1.id, {
      stripeSubscriptionId: 'sub_fail',
      stripeCustomerId: 'cus_fail',
      status: 'active',
      plan: 'pro'
    });
    await insertSubscription(db, user2.id, {
      stripeSubscriptionId: 'sub_ok',
      stripeCustomerId: 'cus_ok',
      status: 'active',
      plan: 'pro'
    });

    mswServer.use(
      http.get('https://api.stripe.com/v1/subscriptions/sub_fail', () =>
        HttpResponse.json(
          { error: { message: 'unavailable' } },
          { status: 503 }
        )
      )
    );

    const { synced, errors } = await reconcileBillingSubscriptions(db);
    expect(synced).toBe(1);
    expect(errors).toBe(1);
  });
});

describe('reconcileBillingSubscriptions - skip policies', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('no stripeSubscriptionId, no stripeCustomerId: skipped silently', async () => {
    const user = await insertUser(db);
    await insertSubscription(db, user.id, {
      stripeSubscriptionId: null,
      stripeCustomerId: null
    });

    const { synced, errors } = await reconcileBillingSubscriptions(db);
    expect(synced).toBe(0);
    expect(errors).toBe(0);
  });

  it('stripeCustomerId present, stripeSubscriptionId null: skipped with warning', async () => {
    const user = await insertUser(db);
    await insertSubscription(db, user.id, {
      stripeSubscriptionId: null,
      stripeCustomerId: 'cus_orphan'
    });

    const { synced, errors } = await reconcileBillingSubscriptions(db);
    expect(synced).toBe(0);
    expect(errors).toBe(0);
  });
});

describe('reconcileBillingSubscriptions - already correct state', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('past_due in both: still updates lastSyncedAt and currentPeriodEnd', async () => {
    const user = await insertUser(db, { hasAccess: false });
    await insertSubscription(db, user.id, {
      stripeSubscriptionId: 'sub_pastdue',
      stripeCustomerId: 'cus_test',
      status: 'past_due',
      plan: 'free'
    });

    mswServer.use(
      http.get('https://api.stripe.com/v1/subscriptions/:id', ({ params }) =>
        HttpResponse.json(
          makeStripeSubResponse(params.id as string, 'past_due')
        )
      )
    );

    const { synced } = await reconcileBillingSubscriptions(db);
    expect(synced).toBe(1);

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub!.lastSyncedAt).not.toBeNull();
    expect(sub!.currentPeriodEnd).not.toBeNull();
  });
});

describe('parity: webhook handlers vs reconciler produce same state', () => {
  const updateCases = [
    { status: 'active', expectedPlan: 'free' as const, expectedAccess: true },
    { status: 'trialing', expectedPlan: 'free' as const, expectedAccess: true },
    { status: 'past_due', expectedPlan: 'free' as const, expectedAccess: false }
  ];

  for (const { status, expectedPlan, expectedAccess } of updateCases) {
    it(`status=${status}: reconciler and handleSubscriptionUpdate agree`, async () => {
      const dbR = makeTestSharedDb();
      const dbW = makeTestSharedDb();

      const userR = await insertUser(dbR, { hasAccess: !expectedAccess });
      const userW = await insertUser(dbW, { hasAccess: !expectedAccess });

      await insertSubscription(dbR, userR.id, {
        stripeSubscriptionId: `sub_parity_${status}`,
        stripeCustomerId: 'cus_test',
        status: 'active',
        plan: 'pro'
      });
      await insertSubscription(dbW, userW.id, {
        stripeSubscriptionId: `sub_parity_${status}`,
        stripeCustomerId: 'cus_test',
        status: 'active',
        plan: 'pro'
      });

      const periodEnd = Math.floor(Date.now() / 1000) + 86400;
      const stripePayload = {
        id: `sub_parity_${status}`,
        object: 'subscription' as const,
        status,
        current_period_end: periodEnd,
        customer: 'cus_test',
        items: { data: [] }
      } as unknown as import('stripe').default.Subscription;

      mswServer.use(
        http.get('https://api.stripe.com/v1/subscriptions/:id', () =>
          HttpResponse.json({ ...stripePayload, current_period_end: periodEnd })
        )
      );

      await reconcileBillingSubscriptions(dbR);
      await handleSubscriptionUpdate(stripePayload, dbW);

      const subR = await dbR.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userR.id)
      });
      const subW = await dbW.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userW.id)
      });
      const userDbR = await dbR.query.users.findFirst({
        where: eq(users.id, userR.id)
      });
      const userDbW = await dbW.query.users.findFirst({
        where: eq(users.id, userW.id)
      });

      expect(subR!.status).toBe(subW!.status);
      expect(subR!.plan).toBe(subW!.plan);
      expect(userDbR!.hasAccess).toBe(userDbW!.hasAccess);
      expect(subR!.status).toBe(status);
      expect(subR!.plan).toBe(expectedPlan);
      expect(userDbR!.hasAccess).toBe(expectedAccess);
    });
  }

  it('status=canceled: reconciler and handleSubscriptionDeleted agree', async () => {
    const dbR = makeTestSharedDb();
    const dbW = makeTestSharedDb();

    const userR = await insertUser(dbR, { hasAccess: true });
    const userW = await insertUser(dbW, { hasAccess: true });

    await insertSubscription(dbR, userR.id, {
      stripeSubscriptionId: 'sub_parity_canceled',
      stripeCustomerId: 'cus_test',
      status: 'active',
      plan: 'pro'
    });
    await insertSubscription(dbW, userW.id, {
      stripeSubscriptionId: 'sub_parity_canceled',
      stripeCustomerId: 'cus_test',
      status: 'active',
      plan: 'pro'
    });

    const stripePayload = {
      id: 'sub_parity_canceled',
      object: 'subscription' as const,
      status: 'canceled',
      current_period_end: null,
      customer: 'cus_test',
      items: { data: [] }
    } as unknown as import('stripe').default.Subscription;

    mswServer.use(
      http.get('https://api.stripe.com/v1/subscriptions/:id', () =>
        HttpResponse.json({ ...stripePayload, current_period_end: null })
      )
    );

    await reconcileBillingSubscriptions(dbR);
    await handleSubscriptionDeleted(stripePayload, dbW);

    const subR = await dbR.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userR.id)
    });
    const subW = await dbW.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userW.id)
    });
    const userDbR = await dbR.query.users.findFirst({
      where: eq(users.id, userR.id)
    });
    const userDbW = await dbW.query.users.findFirst({
      where: eq(users.id, userW.id)
    });

    expect(subR!.status).toBe(subW!.status);
    expect(subR!.plan).toBe(subW!.plan);
    expect(userDbR!.hasAccess).toBe(userDbW!.hasAccess);
    expect(subR!.status).toBe('canceled');
    expect(subR!.plan).toBe('free');
    expect(userDbR!.hasAccess).toBe(false);
  });
});

describe('reconcileBillingSubscriptions - trial subscription', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('trialing: isActive=true, trialEndsAt synced from stripe trial_end', async () => {
    const user = await insertUser(db, { hasAccess: false });
    await insertSubscription(db, user.id, {
      stripeSubscriptionId: 'sub_trialing',
      stripeCustomerId: 'cus_test',
      status: 'active',
      plan: 'pro'
    });

    const trialEnd = Math.floor(Date.now() / 1000) + 14 * 86400;

    mswServer.use(
      http.get('https://api.stripe.com/v1/subscriptions/:id', ({ params }) =>
        HttpResponse.json(
          makeStripeSubResponse(params.id as string, 'trialing', 14 * 86400, {
            trial_end: trialEnd
          })
        )
      )
    );

    const { synced, errors } = await reconcileBillingSubscriptions(db);
    expect(synced).toBe(1);
    expect(errors).toBe(0);

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub!.status).toBe('trialing');
    expect(sub!.plan).toBe('free');
    expect(sub!.trialEndsAt).not.toBeNull();
    expect(sub!.trialEndsAt!.getTime()).toBe(trialEnd * 1000);

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(dbUser!.hasAccess).toBe(true);
  });
});
