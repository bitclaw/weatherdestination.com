import { beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq, isNull } from 'drizzle-orm';
import { HttpResponse, http } from 'msw';
import { accountDeletionJobs, users } from '@/lib/db/schema';
import { getUserDbPath } from '@/lib/db/user-db';
import {
  createDeletionJob,
  reconcilePendingDeletions,
  runDeletionJob
} from '@/lib/operations/account-deletion.server';
import { hasUsedTrialBefore } from '@/lib/operations/trial-abuse.server';
import { makeTestSharedDb } from '@/test/db';
import { makeUser } from '@/test/fixtures';
import { mswServer } from '@/test/msw/server';

type Db = ReturnType<typeof makeTestSharedDb>;

const insertUser = async (
  db: Db,
  override?: Partial<typeof users.$inferInsert>
) => {
  const user = makeUser(override);
  await db.insert(users).values(user);
  return user;
};

const makeJobParams = (userId: string) => ({
  userId,
  stripeSubscriptionId: 'sub_test',
  stripeCustomerId: 'cus_test',
  initiatedBy: 'user' as const
});

describe('createDeletionJob', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('inserts job with all step timestamps null and sets deletionPendingAt', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job).toBeDefined();
    expect(job!.userId).toBe(user.id);
    expect(job!.stripeCancelledAt).toBeNull();
    expect(job!.stripeDeletedAt).toBeNull();
    expect(job!.userDbDeletedAt).toBeNull();
    expect(job!.sharedUserDeletedAt).toBeNull();
    expect(job!.completedAt).toBeNull();
    expect(job!.attemptCount).toBe(0);

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(dbUser!.deletionPendingAt).not.toBeNull();
  });

  it('is idempotent: second call returns same job id without duplicate', async () => {
    const user = await insertUser(db);
    const { id: id1 } = await createDeletionJob(makeJobParams(user.id), db);
    const { id: id2 } = await createDeletionJob(makeJobParams(user.id), db);

    expect(id1).toBe(id2);

    const jobs = await db.query.accountDeletionJobs.findMany({
      where: eq(accountDeletionJobs.userId, user.id)
    });
    expect(jobs).toHaveLength(1);
  });

  it('does not overwrite deletionPendingAt if already set', async () => {
    const original = new Date(Date.now() - 60_000);
    const user = await insertUser(db, { deletionPendingAt: original });
    await createDeletionJob(makeJobParams(user.id), db);

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    // SQLite timestamp mode stores seconds; truncate ms for comparison
    expect(dbUser!.deletionPendingAt!.getTime()).toBe(
      Math.floor(original.getTime() / 1000) * 1000
    );
  });
});

describe('runDeletionJob - lease', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('returns false when active lease held by another worker', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    // Manually set an unexpired lease
    const futureExpiry = new Date(Date.now() + 60_000);
    await db
      .update(accountDeletionJobs)
      .set({ leaseExpiresAt: futureExpiry })
      .where(eq(accountDeletionJobs.id, id));

    const result = await runDeletionJob(id, db);
    expect(result).toBe(false);
  });

  it('acquires and runs when lease is expired', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    // Set an already-expired lease
    const pastExpiry = new Date(Date.now() - 1_000);
    await db
      .update(accountDeletionJobs)
      .set({ leaseExpiresAt: pastExpiry })
      .where(eq(accountDeletionJobs.id, id));

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);
  });
});

describe('runDeletionJob - happy path', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('completes job, deletes user row, job row survives', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job!.completedAt).not.toBeNull();
    expect(job!.stripeCancelledAt).not.toBeNull();
    expect(job!.stripeDeletedAt).not.toBeNull();
    expect(job!.filesDeletedAt).not.toBeNull();
    expect(job!.userDbDeletedAt).not.toBeNull();
    expect(job!.sharedUserDeletedAt).not.toBeNull();
    expect(job!.leaseExpiresAt).toBeNull();
    expect(job!.lastError).toBeNull();

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(dbUser).toBeUndefined();
  });

  it('increments attemptCount on run', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    await runDeletionJob(id, db);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job!.attemptCount).toBe(1);
  });

  it('skips stripe when IDs are null', async () => {
    // Override Stripe endpoints to fail , if the job erroneously calls them,
    // the error propagates and runDeletionJob returns false.
    mswServer.use(
      http.delete('https://api.stripe.com/v1/subscriptions/:id', () =>
        HttpResponse.json(
          { error: { message: 'unexpected call' } },
          { status: 500 }
        )
      ),
      http.delete('https://api.stripe.com/v1/customers/:id', () =>
        HttpResponse.json(
          { error: { message: 'unexpected call' } },
          { status: 500 }
        )
      )
    );

    const user = await insertUser(db);
    const { id } = await createDeletionJob(
      {
        userId: user.id,
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        initiatedBy: 'user'
      },
      db
    );

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);
  });
});

describe('runDeletionJob - crash simulation / resume', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('skips stripe cancel if stripeCancelledAt already set', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    // Simulate crash after step 1
    await db
      .update(accountDeletionJobs)
      .set({ stripeCancelledAt: new Date() })
      .where(eq(accountDeletionJobs.id, id));

    let cancelCalled = false;
    mswServer.use(
      http.delete('https://api.stripe.com/v1/subscriptions/:id', () => {
        cancelCalled = true;
        return HttpResponse.json({
          id: 'sub_test',
          object: 'subscription',
          status: 'canceled'
        });
      })
    );

    await runDeletionJob(id, db);
    expect(cancelCalled).toBe(false);
  });

  it('skips all stripe steps if both already set, proceeds to user delete', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);
    const now = new Date();

    await db
      .update(accountDeletionJobs)
      .set({ stripeCancelledAt: now, stripeDeletedAt: now })
      .where(eq(accountDeletionJobs.id, id));

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(dbUser).toBeUndefined();
  });

  it('resumes from userDbDeletedAt if that step was done', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);
    const now = new Date();

    await db
      .update(accountDeletionJobs)
      .set({
        stripeCancelledAt: now,
        stripeDeletedAt: now,
        userDbDeletedAt: now
      })
      .where(eq(accountDeletionJobs.id, id));

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job!.completedAt).not.toBeNull();
  });

  it('handles crash after sharedUserDeleted: user already gone, still marks complete', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);
    const now = new Date();

    // Delete user row manually (simulates prior run got to step 4 but crashed before recording it)
    await db.delete(users).where(eq(users.id, user.id));

    await db
      .update(accountDeletionJobs)
      .set({
        stripeCancelledAt: now,
        stripeDeletedAt: now,
        userDbDeletedAt: now
      })
      .where(eq(accountDeletionJobs.id, id));

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job!.completedAt).not.toBeNull();
    expect(job!.sharedUserDeletedAt).not.toBeNull();
  });
});

describe('runDeletionJob - Stripe idempotency', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('treats subscription_cancelled as success and continues', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    mswServer.use(
      http.delete('https://api.stripe.com/v1/subscriptions/:id', () =>
        HttpResponse.json(
          {
            error: {
              code: 'subscription_cancelled',
              message: 'already cancelled'
            }
          },
          { status: 400 }
        )
      )
    );

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job!.stripeCancelledAt).not.toBeNull();
    expect(job!.completedAt).not.toBeNull();
  });

  it('treats resource_missing on customer delete as success and continues', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    mswServer.use(
      http.delete('https://api.stripe.com/v1/customers/:id', () =>
        HttpResponse.json(
          { error: { code: 'resource_missing', message: 'no such customer' } },
          { status: 404 }
        )
      )
    );

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job!.stripeDeletedAt).not.toBeNull();
    expect(job!.completedAt).not.toBeNull();
  });
});

describe('runDeletionJob - Stripe errors stop and set lastError', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('returns false and sets lastError on subscription cancel 503', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    mswServer.use(
      http.delete('https://api.stripe.com/v1/subscriptions/:id', () =>
        HttpResponse.json(
          { error: { message: 'service unavailable' } },
          { status: 503 }
        )
      )
    );

    const result = await runDeletionJob(id, db);
    expect(result).toBe(false);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job!.lastError).not.toBeNull();
    expect(job!.completedAt).toBeNull();
    expect(job!.leaseExpiresAt).toBeNull();
  });

  it('returns false and sets lastError on customer delete 503', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    mswServer.use(
      http.delete('https://api.stripe.com/v1/customers/:id', () =>
        HttpResponse.json(
          { error: { message: 'service unavailable' } },
          { status: 503 }
        )
      )
    );

    const result = await runDeletionJob(id, db);
    expect(result).toBe(false);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job!.lastError).not.toBeNull();
    expect(job!.stripeCancelledAt).not.toBeNull();
    expect(job!.stripeDeletedAt).toBeNull();
    expect(job!.completedAt).toBeNull();
    expect(job!.leaseExpiresAt).toBeNull();
  });

  it('clears lastError when a previously-failed step succeeds on retry', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    mswServer.use(
      http.delete('https://api.stripe.com/v1/subscriptions/:id', () =>
        HttpResponse.json(
          { error: { message: 'service unavailable' } },
          { status: 503 }
        )
      )
    );

    // First run: fails on step 1
    await runDeletionJob(id, db);
    const afterFail = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(afterFail!.lastError).not.toBeNull();

    // Second run: step 1 now succeeds (reset handlers restores default 200)
    mswServer.resetHandlers();
    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);

    const afterRetry = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(afterRetry!.lastError).toBeNull();
    expect(afterRetry!.completedAt).not.toBeNull();
  });
});

describe('runDeletionJob - all steps already done', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('marks complete and returns true without any external calls', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);
    const now = new Date();

    await db.delete(users).where(eq(users.id, user.id));
    await db
      .update(accountDeletionJobs)
      .set({
        stripeCancelledAt: now,
        stripeDeletedAt: now,
        userDbDeletedAt: now,
        sharedUserDeletedAt: now
      })
      .where(eq(accountDeletionJobs.id, id));

    let stripeCalled = false;
    mswServer.use(
      http.delete('https://api.stripe.com/v1/subscriptions/:id', () => {
        stripeCalled = true;
        return HttpResponse.json({});
      }),
      http.delete('https://api.stripe.com/v1/customers/:id', () => {
        stripeCalled = true;
        return HttpResponse.json({});
      })
    );

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);
    expect(stripeCalled).toBe(false);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job!.completedAt).not.toBeNull();
    expect(job!.leaseExpiresAt).toBeNull();
  });
});

describe('runDeletionJob - user directory cleanup', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('removes the user directory from disk', async () => {
    // Isolate under a temp root: getUserDbPath re-reads USER_DATA_DIR on each
    // call, and .env.test's default (data/users) is a real repo-adjacent dir
    // that a killed test run would leak into.
    const originalDataDir = process.env.USER_DATA_DIR;
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'warpkit-del-'));
    process.env.USER_DATA_DIR = tempRoot;

    try {
      const user = await insertUser(db);
      const { id } = await createDeletionJob(makeJobParams(user.id), db);

      const userDir = path.dirname(getUserDbPath(user.id));
      fs.mkdirSync(userDir, { recursive: true });
      fs.writeFileSync(path.join(userDir, 'test.db'), 'content');
      expect(fs.existsSync(userDir)).toBe(true);

      const result = await runDeletionJob(id, db);
      expect(result).toBe(true);
      expect(fs.existsSync(userDir)).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      process.env.USER_DATA_DIR = originalDataDir;
    }
  });
});

describe('runDeletionJob - trial abuse marker', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('records a marker for the deleted user email', async () => {
    const user = await insertUser(db, { email: 'trial-abuser@example.com' });
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    expect(await hasUsedTrialBefore('trial-abuser@example.com', db)).toBe(
      false
    );

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);

    expect(await hasUsedTrialBefore('trial-abuser@example.com', db)).toBe(true);
  });

  it('does not record a marker when the user row is already gone (crash-resumed retry)', async () => {
    const user = await insertUser(db, { email: 'already-gone@example.com' });
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    // Simulate a crash between the real delete and recording the step:
    // user row deleted, but sharedUserDeletedAt never got written.
    await db.delete(users).where(eq(users.id, user.id));

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);
    expect(await hasUsedTrialBefore('already-gone@example.com', db)).toBe(
      false
    );
  });
});

describe('runDeletionJob - file cleanup', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('marks filesDeletedAt even with uploaded files present and no S3 bucket configured', async () => {
    // AWS_S3_FILES_BUCKET is unset in .env.test (uploads aren't configured
    // for the test environment) - the step's `if (bucket)` guard should
    // skip the S3 calls entirely and still mark the step done, rather than
    // hanging or throwing on an unconfigured client.
    const originalDataDir = process.env.USER_DATA_DIR;
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'warpkit-del-files-')
    );
    process.env.USER_DATA_DIR = tempRoot;

    try {
      const user = await insertUser(db);
      const { id } = await createDeletionJob(makeJobParams(user.id), db);

      const { getUserDb } = await import('@/lib/db/user-db');
      const { addFile } = await import(
        '@/features/uploads/server/uploads.server'
      );
      const userDb = getUserDb(user.id);
      addFile(userDb, {
        name: 'photo.png',
        type: 'image/png',
        size: 1234,
        s3Key: `${user.id}/photo.png`
      });

      const result = await runDeletionJob(id, db);
      expect(result).toBe(true);

      const job = await db.query.accountDeletionJobs.findFirst({
        where: eq(accountDeletionJobs.id, id)
      });
      expect(job!.filesDeletedAt).not.toBeNull();
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      process.env.USER_DATA_DIR = originalDataDir;
    }
  });

  it('resumes from filesDeletedAt if that step was already done', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);
    await db
      .update(accountDeletionJobs)
      .set({
        stripeCancelledAt: new Date(),
        stripeDeletedAt: new Date(),
        filesDeletedAt: new Date()
      })
      .where(eq(accountDeletionJobs.id, id));

    const result = await runDeletionJob(id, db);
    expect(result).toBe(true);

    const job = await db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, id)
    });
    expect(job!.completedAt).not.toBeNull();
  });
});

describe('reconcilePendingDeletions', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('completes all pending jobs', async () => {
    const user1 = await insertUser(db);
    const user2 = await insertUser(db);
    await createDeletionJob(makeJobParams(user1.id), db);
    await createDeletionJob(makeJobParams(user2.id), db);

    const { processed, failed } = await reconcilePendingDeletions(db);
    expect(processed).toBe(2);
    expect(failed).toBe(0);

    const remaining = await db.query.accountDeletionJobs.findMany({
      where: isNull(accountDeletionJobs.completedAt)
    });
    expect(remaining).toHaveLength(0);
  });

  it('does not re-process completed jobs', async () => {
    const user = await insertUser(db);
    const { id } = await createDeletionJob(makeJobParams(user.id), db);

    // Complete it
    await runDeletionJob(id, db);

    const { processed, failed } = await reconcilePendingDeletions(db);
    expect(processed).toBe(0);
    expect(failed).toBe(0);
  });

  it('one job throwing during step 4/5 does not block other pending jobs', async () => {
    const user1 = await insertUser(db);
    const user2 = await insertUser(db);
    // Distinct subscription ids so MSW can fail job1's Stripe call only,
    // without mocking the DB or Drizzle - the real Stripe HTTP layer
    // distinguishes the two jobs the same way production traffic would.
    await createDeletionJob(
      { ...makeJobParams(user1.id), stripeSubscriptionId: 'sub_job1' },
      db
    );
    await createDeletionJob(
      { ...makeJobParams(user2.id), stripeSubscriptionId: 'sub_job2' },
      db
    );

    // job1's subscription-cancel call fails (a stand-in for any transient
    // per-job failure during a run); job2's succeeds via the default
    // handler. The reconcile loop must still process the second, unrelated
    // job rather than aborting the whole batch.
    mswServer.use(
      http.delete('https://api.stripe.com/v1/subscriptions/sub_job1', () =>
        HttpResponse.json(
          { error: { message: 'unavailable' } },
          { status: 503 }
        )
      )
    );

    const { processed, failed } = await reconcilePendingDeletions(db);
    expect(processed).toBe(1);
    expect(failed).toBe(1);
  });

  it('counts failed jobs when stripe errors', async () => {
    mswServer.use(
      http.delete('https://api.stripe.com/v1/subscriptions/:id', () =>
        HttpResponse.json(
          { error: { message: 'unavailable' } },
          { status: 503 }
        )
      )
    );

    const user1 = await insertUser(db);
    const user2 = await insertUser(db);
    await createDeletionJob(makeJobParams(user1.id), db);
    await createDeletionJob(makeJobParams(user2.id), db);

    const { processed, failed } = await reconcilePendingDeletions(db);
    expect(processed).toBe(0);
    expect(failed).toBe(2);
  });
});

describe('deletionPendingAt access guard', () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestSharedDb();
  });

  it('createDeletionJob sets deletionPendingAt on the user', async () => {
    const user = await insertUser(db);
    expect(user.deletionPendingAt).toBeUndefined();

    await createDeletionJob(makeJobParams(user.id), db);

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(dbUser!.deletionPendingAt).not.toBeNull();
  });
});
