import { and, eq, gt, sql } from 'drizzle-orm';
import type { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

type Db = typeof db;

export const getCredits = async (
  dbInstance: Db,
  userId: string
): Promise<number> => {
  const row = await dbInstance.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { credits: true }
  });
  return row?.credits ?? 0;
};

export const deductCredit = async (
  dbInstance: Db,
  userId: string
): Promise<{ ok: true; remaining: number } | { ok: false }> => {
  const updated = await dbInstance
    .update(users)
    .set({ credits: sql`credits - 1`, updatedAt: new Date() })
    .where(and(eq(users.id, userId), gt(users.credits, 0)))
    .returning({ credits: users.credits });

  if (updated.length === 0 || updated[0] === undefined) return { ok: false };
  return { ok: true, remaining: updated[0].credits };
};

export const addCredits = async (
  dbInstance: Db,
  userId: string,
  amount: number
): Promise<void> => {
  await dbInstance
    .update(users)
    .set({ credits: sql`credits + ${amount}`, updatedAt: new Date() })
    .where(eq(users.id, userId));
};

// Named alias for addCredits, used specifically to undo a deductCredit()
// call when the metered action never actually ran (e.g. ai-chat.ts's
// stream failing to start after the credit was already deducted). Same
// operation as addCredits - the separate name exists so call sites read as
// "this is a refund," and so this specific use case has its own direct
// test coverage instead of only being exercised indirectly through
// addCredits' generic tests.
export const refundCredit = async (
  dbInstance: Db,
  userId: string,
  amount = 1
): Promise<void> => addCredits(dbInstance, userId, amount);
