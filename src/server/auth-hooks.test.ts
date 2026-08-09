import { beforeEach, describe, expect, it } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { users } from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makeUser } from '@/test/fixtures';
import { onUserCreated, onUserCreatedSafely } from './auth-hooks';

describe('onUserCreated', () => {
  let enqueueCalls: Array<{ type: string; payload: unknown }>;
  const captureEnqueue = (type: string, payload: unknown) => {
    enqueueCalls.push({ type, payload });
  };

  beforeEach(() => {
    enqueueCalls = [];
  });

  it('grants credits when enabled and freeCreditsOnSignup > 0', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    await onUserCreated(
      db,
      user as { id: string; email: string; name: string },
      captureEnqueue,
      {
        enabled: true,
        freeCreditsOnSignup: 10
      }
    );

    const row = await db
      .select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, user.id));
    expect(row[0]?.credits).toBe(10);
  });

  it('skips credit grant when credits disabled', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    await onUserCreated(
      db,
      user as { id: string; email: string; name: string },
      captureEnqueue,
      {
        enabled: false,
        freeCreditsOnSignup: 10
      }
    );

    const row = await db
      .select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, user.id));
    expect(row[0]?.credits).toBe(0);
  });

  it('skips credit grant when freeCreditsOnSignup is 0', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    await onUserCreated(
      db,
      user as { id: string; email: string; name: string },
      captureEnqueue,
      {
        enabled: true,
        freeCreditsOnSignup: 0
      }
    );

    const row = await db
      .select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, user.id));
    expect(row[0]?.credits).toBe(0);
  });

  it('enqueues welcome email with correct payload', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ name: 'Alice', email: 'alice@example.com' });
    await db.insert(users).values(user);

    await onUserCreated(
      db,
      user as { id: string; email: string; name: string },
      captureEnqueue,
      {
        enabled: true,
        freeCreditsOnSignup: 10
      }
    );

    expect(enqueueCalls).toHaveLength(1);
    expect(enqueueCalls[0]).toEqual({
      type: 'email:welcome',
      payload: { userId: user.id, email: 'alice@example.com', name: 'Alice' }
    });
  });

  it('enqueues welcome email even when credits disabled', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ name: 'Bob', email: 'bob@example.com' });
    await db.insert(users).values(user);

    await onUserCreated(
      db,
      user as { id: string; email: string; name: string },
      captureEnqueue,
      {
        enabled: false,
        freeCreditsOnSignup: 10
      }
    );

    expect(enqueueCalls).toHaveLength(1);
    expect(enqueueCalls[0]?.type).toBe('email:welcome');
  });
});

describe('onUserCreatedSafely', () => {
  it('does not throw when the enqueue callback throws', async () => {
    const db = makeTestSharedDb();
    const user = makeUser();
    await db.insert(users).values(user);

    const throwingEnqueue = () => {
      throw new Error('jobs db unavailable');
    };

    await expect(
      onUserCreatedSafely(
        db,
        user as { id: string; email: string; name: string },
        throwingEnqueue,
        { enabled: true, freeCreditsOnSignup: 10 }
      )
    ).resolves.toBeUndefined();
  });

  it('does not throw when the credits grant write fails', async () => {
    const user = makeUser();
    // Force a real DB failure (rather than a silent no-op UPDATE) by
    // dropping the users table before onUserCreated tries to write to it.
    const brokenDb = makeTestSharedDb();
    await brokenDb.run(sql`DROP TABLE users`);

    await expect(
      onUserCreatedSafely(
        brokenDb,
        { id: user.id, email: user.email, name: user.name },
        () => {},
        { enabled: true, freeCreditsOnSignup: 10 }
      )
    ).resolves.toBeUndefined();
  });
});
