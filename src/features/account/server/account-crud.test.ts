import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { subscriptions, users } from '@/lib/db/schema';
import { makeTestDb, makeTestSharedDb } from '@/test/db';
import { makeSubscription, makeUser } from '@/test/fixtures';
import { dumpUserDbTables } from './account.server';

// ---------------------------------------------------------------------------
// Per-user SQLite (dumpUserDbTables)
// ---------------------------------------------------------------------------

describe('dumpUserDbTables', () => {
  it('excludes _warpkit_migrations from export', () => {
    const db = makeTestDb();
    const result = dumpUserDbTables(db);
    expect('_warpkit_migrations' in result).toBe(false);
  });

  it('returns empty array for table with no rows', () => {
    const db = makeTestDb();
    const result = dumpUserDbTables(db);
    expect(result.user_events).toEqual([]);
  });

  it('exports all rows from a table', () => {
    const db = makeTestDb();
    db.run('INSERT INTO user_events (id, type, created_at) VALUES (?, ?, ?)', [
      'a',
      'test.event',
      1000
    ]);
    db.run('INSERT INTO user_events (id, type, created_at) VALUES (?, ?, ?)', [
      'b',
      'test.event',
      2000
    ]);
    const result = dumpUserDbTables(db);
    expect(result.user_events).toHaveLength(2);
  });

  it('includes all columns for each row', () => {
    const db = makeTestDb();
    db.run('INSERT INTO user_events (id, type, created_at) VALUES (?, ?, ?)', [
      'x',
      'test.event',
      999
    ]);
    const result = dumpUserDbTables(db);
    expect(result.user_events?.[0]).toMatchObject({
      id: 'x',
      type: 'test.event',
      created_at: 999
    });
  });

  it('exports multiple tables when present', () => {
    const db = makeTestDb();
    db.run(
      'CREATE TABLE extra_things (id TEXT PRIMARY KEY, val TEXT NOT NULL)'
    );
    db.run("INSERT INTO extra_things (id, val) VALUES ('1', 'foo')");
    const result = dumpUserDbTables(db);
    expect('user_events' in result).toBe(true);
    expect('extra_things' in result).toBe(true);
    expect(result.extra_things).toHaveLength(1);
    expect(result.extra_things?.[0]).toMatchObject({ id: '1', val: 'foo' });
  });

  it('redacts api key material from the export', () => {
    const db = makeTestDb();
    db.run(
      `INSERT INTO api_keys
         (id, name, key_hash, key_preview, status, last_used_at, created_at)
       VALUES ('k1', 'CI key', 'deadbeef', 'wk_••••••••...beef', 'active', NULL, 1000)`
    );
    const result = dumpUserDbTables(db);
    expect(result.api_keys).toHaveLength(1);
    expect(result.api_keys?.[0]).toMatchObject({
      id: 'k1',
      name: 'CI key',
      key_hash: '[redacted]'
    });
    expect(JSON.stringify(result)).not.toContain('deadbeef');
  });
});

// ---------------------------------------------------------------------------
// Shared DB: schema cascade behavior (validates our DDL, not SQLite itself)
// ---------------------------------------------------------------------------

describe('users cascade deletes', () => {
  it('deleting a user removes their subscription', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(makeSubscription(user.id));

    await db.delete(users).where(eq(users.id, user.id));

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id)
    });
    expect(sub).toBeUndefined();
  });

  it('deleting a user with active subscription leaves no orphan rows', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);
    await db.insert(subscriptions).values(
      makeSubscription(user.id, {
        plan: 'pro',
        status: 'active',
        stripeCustomerId: 'cus_test',
        stripeSubscriptionId: 'sub_test'
      })
    );

    await db.delete(users).where(eq(users.id, user.id));

    const allSubs = await db.select().from(subscriptions);
    expect(allSubs.every(s => s.userId !== user.id)).toBe(true);
  });
});
