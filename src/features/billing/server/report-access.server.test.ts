import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { config } from '@/config';
import { purchases, users } from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makePurchase, makeUser } from '@/test/fixtures';
import { hasReportAccess } from './report-access.server';

// Round-2 audit: zero test coverage on the entitlement gate itself.
// .env.test has no VITE_STRIPE_REPORT_PRICE_ID, so config's report priceId
// is '' by default - that's the "not configured" path, tested below as-is.
// For the real matching-purchase path, the report plan's priceId is
// mutated directly here (config is `as const satisfies AppConfig`, which
// is a type-level readonly only, not Object.freeze) and restored in
// afterAll, since hasReportAccess reads config.stripe.plans directly with
// no injectable seam.

const reportPlan = config.stripe.plans.find(p => p.id === 'report');
const originalPriceId = reportPlan?.oneTime?.priceId;
const TEST_PRICE_ID = 'price_report_test';

beforeAll(() => {
  if (reportPlan?.oneTime) {
    // weak-type-ok: config is `as const`, mutating a test-only override of
    // a value that's read-only at the type level, not at runtime
    (reportPlan.oneTime as { priceId: string }).priceId = TEST_PRICE_ID;
  }
});

afterAll(() => {
  if (reportPlan?.oneTime && originalPriceId !== undefined) {
    (reportPlan.oneTime as { priceId: string }).priceId = originalPriceId;
  }
});

describe('hasReportAccess', () => {
  it('returns true for a matching, non-refunded purchase', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db
      .insert(purchases)
      .values(makePurchase(user.id, { stripePriceId: TEST_PRICE_ID }));

    expect(await hasReportAccess(db, user.id)).toBe(true);
  });

  it('returns false when the user has no purchases at all', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    expect(await hasReportAccess(db, user.id)).toBe(false);
  });

  it('returns false when the purchase was refunded', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db.insert(purchases).values(
      makePurchase(user.id, {
        stripePriceId: TEST_PRICE_ID,
        refundedAt: new Date()
      })
    );

    expect(await hasReportAccess(db, user.id)).toBe(false);
  });

  it('returns false when the purchase is for a different price id (e.g. a credits top-up)', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db
      .insert(purchases)
      .values(makePurchase(user.id, { stripePriceId: 'price_something_else' }));

    expect(await hasReportAccess(db, user.id)).toBe(false);
  });

  it("does not grant access from another user's purchase", async () => {
    const db = makeTestSharedDb();
    const buyer = makeUser();
    const other = makeUser();
    await db.insert(users).values([buyer, other]);
    await db
      .insert(purchases)
      .values(makePurchase(buyer.id, { stripePriceId: TEST_PRICE_ID }));

    expect(await hasReportAccess(db, other.id)).toBe(false);
  });

  it('returns false unconditionally when no report price id is configured, even with a matching purchase', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db
      .insert(purchases)
      .values(makePurchase(user.id, { stripePriceId: TEST_PRICE_ID }));

    if (reportPlan?.oneTime) {
      (reportPlan.oneTime as { priceId: string }).priceId = '';
    }
    try {
      expect(await hasReportAccess(db, user.id)).toBe(false);
    } finally {
      if (reportPlan?.oneTime) {
        (reportPlan.oneTime as { priceId: string }).priceId = TEST_PRICE_ID;
      }
    }
  });
});
