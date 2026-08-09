import { describe, expect, it } from 'bun:test';
import { users } from '@/lib/db/schema';
import { getPlanLimits } from '@/lib/entitlements';
import { makeTestSharedDb } from '@/test/db';
import { makeUser } from '@/test/fixtures';
import {
  countFeatureRequestsByUser,
  createFeatureRequest,
  deleteFeatureRequest,
  listFeatureRequests,
  toggleFeatureRequestVote,
  updateFeatureRequest
} from './feature-requests.server';

const insertUser = async (db: ReturnType<typeof makeTestSharedDb>) => {
  const user = makeUser();
  await db.insert(users).values(user);
  return user;
};

describe('feature_requests CRUD', () => {
  it('returns empty list on a fresh board', async () => {
    const db = makeTestSharedDb();
    const user = await insertUser(db);
    expect(await listFeatureRequests(db, user.id)).toEqual([]);
  });

  it('creates a request with defaults', async () => {
    const db = makeTestSharedDb();
    const user = await insertUser(db);
    const result = await createFeatureRequest(
      db,
      {
        userId: user.id,
        title: '  Dark mode for emails  '
      },
      'free'
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Dark mode for emails');
    expect(result.data.status).toBe('submitted');
    expect(result.data.priority).toBe('medium');
    expect(result.data.category).toBe('other');
    expect(result.data.voteCount).toBe(0);
    expect(result.data.votedByMe).toBe(false);
  });

  it('list is visible to a different user (shared board)', async () => {
    const db = makeTestSharedDb();
    const creator = await insertUser(db);
    const viewer = await insertUser(db);
    await createFeatureRequest(
      db,
      {
        userId: creator.id,
        title: 'Shared idea'
      },
      'free'
    );

    const asViewer = await listFeatureRequests(db, viewer.id);
    expect(asViewer).toHaveLength(1);
    expect(asViewer[0]?.userId).toBe(creator.id);
  });
});

describe('updateFeatureRequest', () => {
  it('updates title/status/priority/category', async () => {
    const db = makeTestSharedDb();
    const user = await insertUser(db);
    const created = await createFeatureRequest(
      db,
      {
        userId: user.id,
        title: 'Original'
      },
      'free'
    );
    if (!created.ok) throw new Error('setup failed');

    const result = await updateFeatureRequest(db, {
      id: created.data.id,
      title: 'Updated title',
      status: 'planned',
      priority: 'high'
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Updated title');
    expect(result.data.status).toBe('planned');
    expect(result.data.priority).toBe('high');
  });

  it('returns NOT_FOUND for a missing id', async () => {
    const db = makeTestSharedDb();
    const result = await updateFeatureRequest(db, {
      id: 'nonexistent',
      title: 'x'
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });
});

describe('deleteFeatureRequest', () => {
  it('deletes an existing request', async () => {
    const db = makeTestSharedDb();
    const user = await insertUser(db);
    const created = await createFeatureRequest(
      db,
      {
        userId: user.id,
        title: 'To delete'
      },
      'free'
    );
    if (!created.ok) throw new Error('setup failed');

    const result = await deleteFeatureRequest(db, created.data.id);
    expect(result.ok).toBe(true);
    expect(await listFeatureRequests(db, user.id)).toEqual([]);
  });

  it('returns NOT_FOUND for a missing id', async () => {
    const db = makeTestSharedDb();
    const result = await deleteFeatureRequest(db, 'nonexistent');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('cascade-deletes votes when the request is deleted', async () => {
    const db = makeTestSharedDb();
    const creator = await insertUser(db);
    const voter = await insertUser(db);
    const created = await createFeatureRequest(
      db,
      {
        userId: creator.id,
        title: 'Votable'
      },
      'free'
    );
    if (!created.ok) throw new Error('setup failed');
    await toggleFeatureRequestVote(db, created.data.id, voter.id);

    await deleteFeatureRequest(db, created.data.id);
    // No FK-constraint error getting here means the vote row cascaded away
    // cleanly along with the request it belonged to.
    expect(await listFeatureRequests(db, creator.id)).toEqual([]);
  });
});

describe('toggleFeatureRequestVote', () => {
  it('adds a vote on first toggle', async () => {
    const db = makeTestSharedDb();
    const creator = await insertUser(db);
    const voter = await insertUser(db);
    const created = await createFeatureRequest(
      db,
      {
        userId: creator.id,
        title: 'Vote me'
      },
      'free'
    );
    if (!created.ok) throw new Error('setup failed');

    const result = await toggleFeatureRequestVote(
      db,
      created.data.id,
      voter.id
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.votedByMe).toBe(true);
    expect(result.data.voteCount).toBe(1);
  });

  it('removes the vote on second toggle', async () => {
    const db = makeTestSharedDb();
    const creator = await insertUser(db);
    const voter = await insertUser(db);
    const created = await createFeatureRequest(
      db,
      {
        userId: creator.id,
        title: 'Vote me'
      },
      'free'
    );
    if (!created.ok) throw new Error('setup failed');

    await toggleFeatureRequestVote(db, created.data.id, voter.id);
    const result = await toggleFeatureRequestVote(
      db,
      created.data.id,
      voter.id
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.votedByMe).toBe(false);
    expect(result.data.voteCount).toBe(0);
  });

  it('two different users voting both count', async () => {
    const db = makeTestSharedDb();
    const creator = await insertUser(db);
    const voterA = await insertUser(db);
    const voterB = await insertUser(db);
    const created = await createFeatureRequest(
      db,
      {
        userId: creator.id,
        title: 'Popular'
      },
      'free'
    );
    if (!created.ok) throw new Error('setup failed');

    await toggleFeatureRequestVote(db, created.data.id, voterA.id);
    const result = await toggleFeatureRequestVote(
      db,
      created.data.id,
      voterB.id
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.voteCount).toBe(2);
  });

  it('concurrent toggles from the same user do not double-insert past the unique constraint', async () => {
    const db = makeTestSharedDb();
    const creator = await insertUser(db);
    const voter = await insertUser(db);
    const created = await createFeatureRequest(
      db,
      {
        userId: creator.id,
        title: 'Race'
      },
      'free'
    );
    if (!created.ok) throw new Error('setup failed');

    // Both read "no vote" before either writes - the sync transaction
    // should still leave the DB in a consistent state (exactly one of the
    // two toggles' effects "wins" the race, no unique-constraint crash).
    await Promise.all([
      toggleFeatureRequestVote(db, created.data.id, voter.id),
      toggleFeatureRequestVote(db, created.data.id, voter.id)
    ]);

    const list = await listFeatureRequests(db, voter.id);
    // Either 0 or 1 vote depending on which toggle landed last - the
    // invariant that matters is it's never negative and never > 1.
    expect([0, 1]).toContain(list[0]?.voteCount ?? -1);
  });

  it('returns NOT_FOUND when the request does not exist', async () => {
    const db = makeTestSharedDb();
    const voter = await insertUser(db);
    const result = await toggleFeatureRequestVote(db, 'nonexistent', voter.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('list orders by vote count, most-voted first', async () => {
    const db = makeTestSharedDb();
    const creator = await insertUser(db);
    const voterA = await insertUser(db);
    const voterB = await insertUser(db);
    const low = await createFeatureRequest(
      db,
      {
        userId: creator.id,
        title: 'Low votes'
      },
      'free'
    );
    const high = await createFeatureRequest(
      db,
      {
        userId: creator.id,
        title: 'High votes'
      },
      'free'
    );
    if (!low.ok || !high.ok) throw new Error('setup failed');

    await toggleFeatureRequestVote(db, low.data.id, voterA.id);
    await toggleFeatureRequestVote(db, high.data.id, voterA.id);
    await toggleFeatureRequestVote(db, high.data.id, voterB.id);

    const list = await listFeatureRequests(db, creator.id);
    expect(list[0]?.id).toBe(high.data.id);
    expect(list[0]?.voteCount).toBe(2);
    expect(list[1]?.id).toBe(low.data.id);
    expect(list[1]?.voteCount).toBe(1);
  });
});

describe('createFeatureRequest quota enforcement', () => {
  it('rejects creation once the plan limit is reached', async () => {
    const db = makeTestSharedDb();
    const user = await insertUser(db);
    const limit = getPlanLimits('free').maxFeatureRequests;

    for (let i = 0; i < limit; i++) {
      const result = await createFeatureRequest(
        db,
        { userId: user.id, title: `Request ${i}` },
        'free'
      );
      expect(result.ok).toBe(true);
    }

    const overLimit = await createFeatureRequest(
      db,
      { userId: user.id, title: 'Over limit' },
      'free'
    );
    expect(overLimit.ok).toBe(false);
    if (overLimit.ok) return;
    expect(overLimit.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(await countFeatureRequestsByUser(db, user.id)).toBe(limit);
  });

  it('count-check-insert is atomic: concurrent requests at the limit boundary never exceed it', async () => {
    const db = makeTestSharedDb();
    const user = await insertUser(db);
    const limit = getPlanLimits('free').maxFeatureRequests;

    for (let i = 0; i < limit - 1; i++) {
      const result = await createFeatureRequest(
        db,
        { userId: user.id, title: `Request ${i}` },
        'free'
      );
      expect(result.ok).toBe(true);
    }

    // One slot left. Two concurrent creates both read the pre-insert count
    // before either commits - if count-check-insert weren't a single sync
    // transaction, both could read "one slot left" and both succeed,
    // pushing the user one over their plan limit.
    const results = await Promise.all([
      createFeatureRequest(db, { userId: user.id, title: 'Race A' }, 'free'),
      createFeatureRequest(db, { userId: user.id, title: 'Race B' }, 'free')
    ]);

    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.filter(r => !r.ok)).toHaveLength(1);
    expect(await countFeatureRequestsByUser(db, user.id)).toBe(limit);
  });
});

describe('countFeatureRequestsByUser', () => {
  it("counts only the given user's own requests", async () => {
    const db = makeTestSharedDb();
    const userA = await insertUser(db);
    const userB = await insertUser(db);
    await createFeatureRequest(db, { userId: userA.id, title: 'A1' }, 'free');
    await createFeatureRequest(db, { userId: userA.id, title: 'A2' }, 'free');
    await createFeatureRequest(db, { userId: userB.id, title: 'B1' }, 'free');

    expect(await countFeatureRequestsByUser(db, userA.id)).toBe(2);
    expect(await countFeatureRequestsByUser(db, userB.id)).toBe(1);
  });
});
