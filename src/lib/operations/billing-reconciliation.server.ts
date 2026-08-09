import { eq } from 'drizzle-orm';
import { config, type PlanId } from '@/config';
import { isSubscriptionActive } from '@/features/billing/server/billing.rules.server';
import { invalidateSubscriptionCache } from '@/features/billing/server/billing.server';
import {
  getPeriodEnd,
  getPlanIdForPriceId,
  parseTrialEnd
} from '@/features/billing/server/stripe-shared.server';
import { db as globalDb } from '@/lib/db';
import { subscriptions, users } from '@/lib/db/schema';
import { stripe } from '@/lib/http-clients';
import { createLogger } from '@/lib/logger';
import { invalidateBootstrapCache } from '@/server/functions/bootstrap-cache';

const log = createLogger({ module: 'billing-reconciliation' });

type Db = typeof globalDb;

export const reconcileBillingSubscriptions = async (
  _db: Db = globalDb
): Promise<{ synced: number; errors: number }> => {
  if (config.billing.mode !== 'subscription') return { synced: 0, errors: 0 };

  const rows = await _db.query.subscriptions.findMany({
    orderBy: (t, { asc }) => [asc(t.createdAt)]
  });

  let synced = 0;
  let errors = 0;

  for (const row of rows) {
    if (!row.stripeSubscriptionId) {
      if (row.stripeCustomerId) {
        log.warn(
          { userId: row.userId, stripeCustomerId: row.stripeCustomerId },
          'subscription row has customer but no subscription ID, skipping'
        );
      }
      continue;
    }

    let stripeSub: Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>;

    try {
      stripeSub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
    } catch (error) {
      const isResourceMissing =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'resource_missing';

      if (isResourceMissing) {
        const now = new Date();
        // Sync callback , bun:sqlite's native transaction() wrapper doesn't
        // await async callbacks (COMMIT fires at the first internal await,
        // with no rollback on a later throw). All drizzle bun-sqlite calls
        // are synchronous under the hood; .run() makes that explicit.
        _db.transaction(tx => {
          tx.update(subscriptions)
            .set({
              status: 'canceled',
              plan: 'free',
              currentPeriodEnd: null,
              lastSyncedAt: now,
              updatedAt: now
            })
            .where(eq(subscriptions.userId, row.userId))
            .run();

          tx.update(users)
            .set({ hasAccess: false, updatedAt: now })
            .where(eq(users.id, row.userId))
            .run();
        });
        invalidateSubscriptionCache(row.userId);
        invalidateBootstrapCache(row.userId);
        synced++;
        continue;
      }

      log.error(
        {
          userId: row.userId,
          stripeSubscriptionId: row.stripeSubscriptionId,
          error
        },
        'stripe subscription retrieve failed'
      );
      errors++;
      continue;
    }

    const isActive = isSubscriptionActive(stripeSub);
    const rawSub = stripeSub as unknown as Record<string, unknown>;
    const activePriceId = stripeSub.items?.data[0]?.price?.id;
    const derivedPlan: PlanId | 'free' = isActive
      ? (getPlanIdForPriceId(activePriceId) ?? 'free')
      : 'free';
    const derivedPeriodEnd = getPeriodEnd(stripeSub);
    const trialEndsAt = parseTrialEnd(
      rawSub.trial_end as number | null | undefined
    );

    const now = new Date();

    // Sync callback , see the comment on the resource_missing branch above.
    _db.transaction(tx => {
      tx.update(subscriptions)
        .set({
          status: stripeSub.status,
          plan: derivedPlan,
          currentPeriodEnd: derivedPeriodEnd,
          trialEndsAt,
          lastSyncedAt: now,
          updatedAt: now
        })
        .where(eq(subscriptions.userId, row.userId))
        .run();

      tx.update(users)
        .set({ hasAccess: isActive, updatedAt: now })
        .where(eq(users.id, row.userId))
        .run();
    });

    invalidateSubscriptionCache(row.userId);
    invalidateBootstrapCache(row.userId);
    synced++;
  }

  return { synced, errors };
};
