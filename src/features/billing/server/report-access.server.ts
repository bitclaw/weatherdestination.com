import { and, eq, isNull } from 'drizzle-orm';
import { config } from '@/config';
import type { db as sharedDb } from '@/lib/db';
import { purchases } from '@/lib/db/schema';

type Db = typeof sharedDb;

// Gated on `purchases` (a non-refunded row matching the report's price id),
// not the global `users.hasAccess` boolean - hasAccess is one sticky flag
// shared across every future paid tier, so gating on it would let a $29
// report buyer auto-unlock any higher-priced tier added later for free.
// This costs one query, not a schema change, and keeps the pricing ladder
// intact. See config.ts's `stripePlans` comment for the full rationale.
export const hasReportAccess = async (
  db: Db,
  userId: string
): Promise<boolean> => {
  const reportPlan = config.stripe.plans.find(p => p.id === 'report');
  const priceId = reportPlan?.oneTime?.priceId;
  if (!priceId) return false;

  const purchase = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.userId, userId),
      eq(purchases.stripePriceId, priceId),
      isNull(purchases.refundedAt)
    )
  });
  return purchase != null;
};
