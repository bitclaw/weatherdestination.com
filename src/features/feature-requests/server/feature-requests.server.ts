import { err, ok } from '@bitclaw/result';
import { randomUUIDv7 } from 'bun';
import { and, count, eq, inArray } from 'drizzle-orm';
import { ERROR_CODES } from '@/lib/constants';
import type { db as SharedDb } from '@/lib/db';
import { featureRequests, featureRequestVotes } from '@/lib/db/schema';
import type { PlanKey } from '@/lib/entitlements';
import { checkEntitlement } from '@/lib/entitlements';
import type {
  FeatureRequestCategory,
  FeatureRequestPriority,
  FeatureRequestRecord,
  FeatureRequestStatus
} from '../feature-requests.constants';

type Db = typeof SharedDb;

type FeatureRequestRow = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  createdAt: Date;
  updatedAt: Date | null;
};

const toView = (
  row: FeatureRequestRow,
  voteCount: number,
  votedByMe: boolean
): FeatureRequestRecord => ({
  id: row.id,
  userId: row.userId,
  title: row.title,
  description: row.description,
  status: row.status as FeatureRequestStatus,
  priority: row.priority as FeatureRequestPriority,
  category: row.category as FeatureRequestCategory,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  voteCount,
  votedByMe
});

// Shared board - every user sees the same list, ordered by vote count so the
// most-wanted requests surface first (ties broken by newest).
export const listFeatureRequests = async (
  db: Db,
  viewerId: string
): Promise<FeatureRequestRecord[]> => {
  const rows = await db.query.featureRequests.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)]
  });
  if (rows.length === 0) return [];

  const ids = rows.map(r => r.id);
  const [voteCounts, myVotes] = await Promise.all([
    db
      .select({
        featureRequestId: featureRequestVotes.featureRequestId,
        n: count()
      })
      .from(featureRequestVotes)
      .where(inArray(featureRequestVotes.featureRequestId, ids))
      .groupBy(featureRequestVotes.featureRequestId),
    db.query.featureRequestVotes.findMany({
      where: and(
        inArray(featureRequestVotes.featureRequestId, ids),
        eq(featureRequestVotes.userId, viewerId)
      ),
      columns: { featureRequestId: true }
    })
  ]);

  const countByRequest = new Map(
    voteCounts.map(v => [v.featureRequestId, v.n])
  );
  const myVoteSet = new Set(myVotes.map(v => v.featureRequestId));

  const records = rows.map(row =>
    toView(row, countByRequest.get(row.id) ?? 0, myVoteSet.has(row.id))
  );
  // Most-voted first, newest-first as the tiebreak (rows already came back
  // newest-first from the query, so a stable sort here preserves that).
  records.sort((a, b) => b.voteCount - a.voteCount);
  return records;
};

export const countFeatureRequestsByUser = async (
  db: Db,
  userId: string
): Promise<number> => {
  const rows = await db.query.featureRequests.findMany({
    where: eq(featureRequests.userId, userId),
    columns: { id: true }
  });
  return rows.length;
};

export type CreateFeatureRequestInput = {
  userId: string;
  title: string;
  description?: string;
  category?: FeatureRequestCategory;
};

// Quota check (count) and insert run inside one sync transaction (CLAUDE.md
// "Shared-DB Transactions Must Use Sync Callbacks") so the count is read and
// the row inserted atomically - without this, two concurrent requests from
// the same user could both read the same pre-insert count, both pass the
// entitlement check, and let the user exceed maxFeatureRequests by one.
export const createFeatureRequest = (
  db: Db,
  input: CreateFeatureRequestInput,
  plan: PlanKey
) => {
  const now = new Date();
  const id = randomUUIDv7();
  const title = input.title.trim();
  const description = input.description?.trim() ?? null;
  const category = input.category ?? 'other';

  return db.transaction(tx => {
    const existingCount = tx.query.featureRequests
      .findMany({
        where: eq(featureRequests.userId, input.userId),
        columns: { id: true }
      })
      .sync().length;

    const { allowed, used, limit } = checkEntitlement(
      plan,
      'maxFeatureRequests',
      existingCount
    );
    if (!allowed)
      return err(
        ERROR_CODES.PLAN_LIMIT_EXCEEDED,
        `Feature request limit reached: ${used}/${limit} on the ${plan} plan. Upgrade to create more.`
      );

    tx.insert(featureRequests)
      .values({
        id,
        userId: input.userId,
        title,
        description,
        status: 'submitted',
        priority: 'medium',
        category,
        createdAt: now,
        updatedAt: null
      })
      .run();

    return ok(
      toView(
        {
          id,
          userId: input.userId,
          title,
          description,
          status: 'submitted',
          priority: 'medium',
          category,
          createdAt: now,
          updatedAt: null
        },
        0,
        false
      )
    );
  });
};

export type UpdateFeatureRequestInput = {
  id: string;
  title: string;
  description?: string;
  status?: FeatureRequestStatus;
  priority?: FeatureRequestPriority;
  category?: FeatureRequestCategory;
};

export const updateFeatureRequest = async (
  db: Db,
  input: UpdateFeatureRequestInput
) => {
  const existing = await db.query.featureRequests.findFirst({
    where: eq(featureRequests.id, input.id)
  });
  if (!existing)
    return err(ERROR_CODES.NOT_FOUND, 'Feature request not found.');

  const now = new Date();
  const updated = {
    title: input.title.trim(),
    description: input.description?.trim() ?? existing.description,
    status: input.status ?? existing.status,
    priority: input.priority ?? existing.priority,
    category: input.category ?? existing.category,
    updatedAt: now
  };
  await db
    .update(featureRequests)
    .set(updated)
    .where(eq(featureRequests.id, input.id));

  const [voteCount] = await db
    .select({ n: count() })
    .from(featureRequestVotes)
    .where(eq(featureRequestVotes.featureRequestId, input.id));

  return ok(
    toView(
      { ...existing, ...updated },
      voteCount?.n ?? 0,
      false // caller (admin triage) doesn't need votedByMe accuracy here
    )
  );
};

export const deleteFeatureRequest = async (db: Db, id: string) => {
  const existing = await db.query.featureRequests.findFirst({
    where: eq(featureRequests.id, id),
    columns: { id: true }
  });
  if (!existing)
    return err(ERROR_CODES.NOT_FOUND, 'Feature request not found.');

  await db.delete(featureRequests).where(eq(featureRequests.id, id));
  return ok({ deleted: true });
};

// Toggle: insert if no vote exists, remove if one does. Sync transaction
// (CLAUDE.md "Shared-DB Transactions Must Use Sync Callbacks") makes the
// check-then-write atomic - without it, two concurrent toggles from the
// same user could both see "no vote" and both insert, tripping the unique
// constraint as a raw DB error instead of behaving like a clean toggle.
export const toggleFeatureRequestVote = async (
  db: Db,
  featureRequestId: string,
  userId: string
) => {
  const requestExists = await db.query.featureRequests.findFirst({
    where: eq(featureRequests.id, featureRequestId),
    columns: { id: true }
  });
  if (!requestExists)
    return err(ERROR_CODES.NOT_FOUND, 'Feature request not found.');

  const votedByMe = db.transaction(tx => {
    const existingVote = tx.query.featureRequestVotes
      .findFirst({
        where: and(
          eq(featureRequestVotes.featureRequestId, featureRequestId),
          eq(featureRequestVotes.userId, userId)
        ),
        columns: { id: true }
      })
      .sync();

    if (existingVote) {
      tx.delete(featureRequestVotes)
        .where(eq(featureRequestVotes.id, existingVote.id))
        .run();
      return false;
    }

    tx.insert(featureRequestVotes)
      .values({
        id: randomUUIDv7(),
        featureRequestId,
        userId,
        createdAt: new Date()
      })
      .run();
    return true;
  });

  const [voteCount] = await db
    .select({ n: count() })
    .from(featureRequestVotes)
    .where(eq(featureRequestVotes.featureRequestId, featureRequestId));

  return ok({ votedByMe, voteCount: voteCount?.n ?? 0 });
};
