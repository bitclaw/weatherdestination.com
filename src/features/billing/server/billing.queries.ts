import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { purchases } from '@/lib/db/schema';
import { requireUser } from '@/server/require-user';
import { getCachedSubscription } from './billing.server';

export const getSubscriptionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return ok(await getCachedSubscription(user.id, db));
  }
);

export const getOneTimePurchaseFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    const purchase = await db.query.purchases.findFirst({
      where: eq(purchases.userId, user.id)
    });
    return ok(purchase ?? null);
  }
);
