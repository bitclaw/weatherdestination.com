import { describe, expect, it } from 'bun:test';
import { randomUUIDv7 } from 'bun';
import { accounts, subscriptions, users } from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makeSubscription, makeUser } from '@/test/fixtures';

// Regression tests for constraints added after two real bugs: two racing
// webhook deliveries could otherwise write the same Stripe customer/
// subscription id onto two different rows, and nothing stopped one OAuth
// identity from linking to two different app users. These tests exist to
// prove the DB itself rejects that, not just application logic.

describe('subscriptions unique constraints', () => {
  it('rejects two rows with the same stripeCustomerId', async () => {
    const db = makeTestSharedDb();
    const userA = makeUser();
    const userB = makeUser();
    await db.insert(users).values([userA, userB]);
    await db
      .insert(subscriptions)
      .values(makeSubscription(userA.id, { stripeCustomerId: 'cus_dup' }));

    await expect(
      (async () => {
        await db
          .insert(subscriptions)
          .values(makeSubscription(userB.id, { stripeCustomerId: 'cus_dup' }));
      })()
    ).rejects.toThrow();
  });

  it('rejects two rows with the same stripeSubscriptionId', async () => {
    const db = makeTestSharedDb();
    const userA = makeUser();
    const userB = makeUser();
    await db.insert(users).values([userA, userB]);
    await db
      .insert(subscriptions)
      .values(makeSubscription(userA.id, { stripeSubscriptionId: 'sub_dup' }));

    await expect(
      (async () => {
        await db
          .insert(subscriptions)
          .values(
            makeSubscription(userB.id, { stripeSubscriptionId: 'sub_dup' })
          );
      })()
    ).rejects.toThrow();
  });
});

describe('accounts unique constraint', () => {
  // better-auth 1.7+ resolves account identity by (issuer, accountId), not
  // (providerId, accountId) - see the `issuer` column comment in schema.ts
  // for why the column itself must stay nullable (SQLite rejects ADD
  // COLUMN ... NOT NULL with no default on a non-empty table).
  it('rejects two rows with the same (issuer, accountId)', async () => {
    const db = makeTestSharedDb();
    const userA = makeUser();
    const userB = makeUser();
    await db.insert(users).values([userA, userB]);

    const now = new Date();
    await db.insert(accounts).values({
      id: randomUUIDv7(),
      accountId: 'external_123',
      providerId: 'google',
      issuer: 'https://accounts.google.com',
      userId: userA.id,
      createdAt: now,
      updatedAt: now
    });

    await expect(
      (async () => {
        await db.insert(accounts).values({
          id: randomUUIDv7(),
          accountId: 'external_123',
          providerId: 'google',
          issuer: 'https://accounts.google.com',
          userId: userB.id,
          createdAt: now,
          updatedAt: now
        });
      })()
    ).rejects.toThrow();
  });

  it('allows the same accountId under a different issuer', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    const now = new Date();
    await db.insert(accounts).values({
      id: randomUUIDv7(),
      accountId: 'shared_id',
      providerId: 'google',
      issuer: 'https://accounts.google.com',
      userId: user.id,
      createdAt: now,
      updatedAt: now
    });

    await expect(
      (async () => {
        await db.insert(accounts).values({
          id: randomUUIDv7(),
          accountId: 'shared_id',
          providerId: 'github',
          issuer: 'local:oauth:github',
          userId: user.id,
          createdAt: now,
          updatedAt: now
        });
      })()
    ).resolves.toBeUndefined();
  });

  // SQLite treats NULL as distinct in a unique index - this is exactly why
  // adding `issuer` as nullable (rather than NOT NULL with a table rebuild)
  // is safe: pre-backfill rows with a null issuer never spuriously collide
  // with each other, even sharing the same accountId.
  it('allows two rows with the same accountId when issuer is null on both (pre-backfill state)', async () => {
    const db = makeTestSharedDb();
    const userA = makeUser();
    const userB = makeUser();
    await db.insert(users).values([userA, userB]);

    const now = new Date();
    await db.insert(accounts).values({
      id: randomUUIDv7(),
      accountId: 'external_456',
      providerId: 'google',
      userId: userA.id,
      createdAt: now,
      updatedAt: now
    });

    await expect(
      (async () => {
        await db.insert(accounts).values({
          id: randomUUIDv7(),
          accountId: 'external_456',
          providerId: 'google',
          userId: userB.id,
          createdAt: now,
          updatedAt: now
        });
      })()
    ).resolves.toBeUndefined();
  });
});
