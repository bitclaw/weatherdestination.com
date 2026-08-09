import fs from 'node:fs';
import path from 'node:path';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUIDv7 } from 'bun';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import {
  getS3Bucket,
  getS3Client,
  listFiles
} from '@/features/uploads/server/uploads.server';
import { db as globalDb } from '@/lib/db';
import { accountDeletionJobs, users } from '@/lib/db/schema';
import {
  closeUserDb,
  getUserDb,
  getUserDbPath,
  withWriteLock
} from '@/lib/db/user-db';
import { stripe } from '@/lib/http-clients';
import { createLogger } from '@/lib/logger';
import { recordTrialAbuseMarker } from '@/lib/operations/trial-abuse.server';
import { emit } from '@/server/events';

const log = createLogger({ module: 'account-deletion' });

const LEASE_TTL_MS = 5 * 60 * 1000;

type Db = typeof globalDb;

type CreateParams = {
  userId: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  initiatedBy: 'user' | 'admin';
};

export const createDeletionJob = async (
  params: CreateParams,
  _db: Db = globalDb
): Promise<{ id: string }> => {
  const now = new Date();

  // Mark user as deletion-pending (idempotent - no-op if already set)
  await _db
    .update(users)
    .set({ deletionPendingAt: now })
    .where(and(eq(users.id, params.userId), isNull(users.deletionPendingAt)));

  await _db
    .insert(accountDeletionJobs)
    .values({
      id: randomUUIDv7(),
      userId: params.userId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      stripeCustomerId: params.stripeCustomerId,
      initiatedBy: params.initiatedBy,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoNothing();

  // May return existing row id if conflict (second call for same userId)
  const job = await _db.query.accountDeletionJobs.findFirst({
    where: eq(accountDeletionJobs.userId, params.userId)
  });

  return { id: job!.id };
};

const makeHelpers = (_db: Db) => {
  const releaseLease = async (jobId: string) => {
    await _db
      .update(accountDeletionJobs)
      .set({ leaseExpiresAt: null, updatedAt: new Date() })
      .where(eq(accountDeletionJobs.id, jobId));
  };

  const markStep = async (
    jobId: string,
    field:
      | 'stripeCancelledAt'
      | 'stripeDeletedAt'
      | 'filesDeletedAt'
      | 'userDbDeletedAt'
      | 'sharedUserDeletedAt'
  ) => {
    await _db
      .update(accountDeletionJobs)
      .set({ [field]: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(accountDeletionJobs.id, jobId));
  };

  const persistError = async (jobId: string, error: unknown) => {
    await _db
      .update(accountDeletionJobs)
      .set({
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date()
      })
      .where(eq(accountDeletionJobs.id, jobId));
  };

  return { releaseLease, markStep, persistError };
};

const isStripeAlreadyGone = (error: unknown, ...codes: string[]): boolean => {
  if (error && typeof error === 'object' && 'code' in error) {
    return codes.includes((error as { code: string }).code);
  }
  return false;
};

export const runDeletionJob = async (
  jobId: string,
  _db: Db = globalDb
): Promise<boolean> => {
  const { releaseLease, markStep, persistError } = makeHelpers(_db);
  const now = new Date();
  const leaseExpiry = new Date(now.getTime() + LEASE_TTL_MS);

  // Acquire lease atomically (absent or expired). Increment attemptCount in same write.
  // Use .returning() to detect whether WHERE matched (Drizzle types don't expose changes count).
  const acquired = await _db
    .update(accountDeletionJobs)
    .set({
      leaseExpiresAt: leaseExpiry,
      lastAttemptAt: now,
      attemptCount: sql`${accountDeletionJobs.attemptCount} + 1`,
      updatedAt: now
    })
    .where(
      and(
        eq(accountDeletionJobs.id, jobId),
        isNull(accountDeletionJobs.completedAt),
        or(
          isNull(accountDeletionJobs.leaseExpiresAt),
          lt(accountDeletionJobs.leaseExpiresAt, now)
        )
      )
    )
    .returning({ id: accountDeletionJobs.id });

  if (acquired.length === 0) {
    log.info(
      { jobId },
      'deletion job lease held or already complete, skipping'
    );
    return false;
  }

  let job: Awaited<ReturnType<typeof _db.query.accountDeletionJobs.findFirst>>;
  try {
    job = await _db.query.accountDeletionJobs.findFirst({
      where: eq(accountDeletionJobs.id, jobId)
    });
  } catch (error) {
    log.error(
      { jobId, error },
      'failed to fetch deletion job after lease acquisition'
    );
    await releaseLease(jobId);
    throw error;
  }

  if (!job) {
    log.error({ jobId }, 'deletion job not found after lease acquisition');
    await releaseLease(jobId);
    return false;
  }

  // Step 1: Cancel Stripe subscription
  if (!job.stripeCancelledAt) {
    if (job.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(job.stripeSubscriptionId);
      } catch (error) {
        if (
          !isStripeAlreadyGone(
            error,
            'subscription_cancelled',
            'resource_missing'
          )
        ) {
          log.error({ jobId, error }, 'stripe subscription cancel failed');
          await persistError(jobId, error);
          await releaseLease(jobId);
          return false;
        }
      }
    }
    await markStep(jobId, 'stripeCancelledAt');
  }

  // Step 2: Delete Stripe customer
  if (!job.stripeDeletedAt) {
    if (job.stripeCustomerId) {
      try {
        await stripe.customers.del(job.stripeCustomerId);
      } catch (error) {
        if (!isStripeAlreadyGone(error, 'resource_missing')) {
          log.error({ jobId, error }, 'stripe customer delete failed');
          await persistError(jobId, error);
          await releaseLease(jobId);
          return false;
        }
      }
    }
    await markStep(jobId, 'stripeDeletedAt');
  }

  // Step 3 (files): Delete S3-hosted uploads. Must run before the next step
  // destroys the per-user DB that holds the file metadata/S3 keys - once
  // that DB is gone there's no way to know what to delete from the bucket.
  if (!job.filesDeletedAt) {
    try {
      const bucket = getS3Bucket();
      if (bucket) {
        const userDb = getUserDb(job.userId);
        const files = listFiles(userDb);
        const client = getS3Client();
        await Promise.all(
          files.map(file =>
            client
              .send(
                new DeleteObjectCommand({ Bucket: bucket, Key: file.s3_key })
              )
              .catch(error => {
                // Don't fail the whole step over one orphaned object - the
                // per-user DB (and thus the s3_key needed to retry) is about
                // to be deleted in the next step regardless.
                log.warn(
                  { jobId, s3Key: file.s3_key, error },
                  's3 file delete failed during account deletion, object orphaned'
                );
              })
          )
        );
      }
    } catch (error) {
      log.error(
        { jobId, error },
        'file cleanup failed during account deletion'
      );
      await persistError(jobId, error);
      await releaseLease(jobId);
      return false;
    }
    await markStep(jobId, 'filesDeletedAt');
  }

  // Step 4: Delete per-user DB. Runs inside the same per-user write lock every
  // mutation uses, so it can't interleave with an in-flight write , either the
  // write finishes first, or it waits until after teardown completes.
  if (!job.userDbDeletedAt) {
    try {
      await withWriteLock(job.userId, () => {
        closeUserDb(job.userId);
        fs.rmSync(path.dirname(getUserDbPath(job.userId)), {
          recursive: true,
          force: true
        });
      });
    } catch (error) {
      log.error({ jobId, error }, 'user db delete failed');
      await persistError(jobId, error);
      await releaseLease(jobId);
      return false;
    }
    await markStep(jobId, 'userDbDeletedAt');
  }

  // Step 5: Delete shared user row - POINT OF NO RETURN
  // db.transaction() ensures user DELETE and step timestamp are atomic.
  // If user row is already gone (crash after step 4 but before recording it),
  // still mark done and continue.
  // Sync callback , bun:sqlite's native transaction() wrapper doesn't await
  // async callbacks (COMMIT fires at the first internal await, with no
  // rollback on a later throw). All drizzle bun-sqlite calls are synchronous
  // under the hood; .run() makes that explicit.
  if (!job.sharedUserDeletedAt) {
    const stepTime = new Date();
    try {
      _db.transaction(tx => {
        // Read email before deleting - this is the last point it exists in
        // the shared DB. If the row's already gone (crash-resumed retry
        // after the delete but before this step was recorded), there's
        // nothing to fingerprint; that's an accepted edge case, same as the
        // "still mark done" comment below already covers.
        const existingUser = tx.query.users
          .findFirst({
            where: eq(users.id, job.userId),
            columns: { email: true }
          })
          .sync();

        tx.delete(users).where(eq(users.id, job.userId)).run();

        if (existingUser) {
          recordTrialAbuseMarker(tx, existingUser.email);
        }

        tx.update(accountDeletionJobs)
          .set({
            sharedUserDeletedAt: stepTime,
            lastError: null,
            updatedAt: stepTime
          })
          .where(eq(accountDeletionJobs.id, jobId))
          .run();
      });
    } catch (error) {
      log.error({ jobId, error }, 'shared user delete failed');
      await persistError(jobId, error);
      await releaseLease(jobId);
      return false;
    }
  }

  // Step 6: emit before marking complete, not after. reconcilePendingDeletions
  // only re-selects rows WHERE completedAt IS NULL, so a crash between the
  // completedAt write and the emit would make this step permanently
  // unretriable , the event would never fire and there'd be no trace of the
  // gap. Emitting first means a crash between emit and the write instead
  // causes a harmless re-emit on the next reconcile pass (account.deleted's
  // current handler is a log-only stub; if a future consumer needs
  // exactly-once delivery, dedup on job id there, the same way webhook
  // handlers dedup on stripe ids elsewhere in this codebase).
  log.info({ jobId, userId: job.userId }, 'account deletion complete');
  await emit('account.deleted', { userId: job.userId });

  try {
    const completedAt = new Date();
    await _db
      .update(accountDeletionJobs)
      .set({
        completedAt,
        lastError: null,
        leaseExpiresAt: null,
        updatedAt: completedAt
      })
      .where(eq(accountDeletionJobs.id, jobId));
  } catch (error) {
    log.error({ jobId, error }, 'deletion completion mark failed');
    await persistError(jobId, error);
    await releaseLease(jobId);
    return false;
  }

  return true;
};

export const reconcilePendingDeletions = async (
  _db: Db = globalDb
): Promise<{ processed: number; failed: number }> => {
  const pending = await _db.query.accountDeletionJobs.findMany({
    where: isNull(accountDeletionJobs.completedAt),
    orderBy: (t, { asc }) => [asc(t.createdAt)]
  });

  let processed = 0;
  let failed = 0;

  for (const job of pending) {
    try {
      const completed = await runDeletionJob(job.id, _db);
      if (completed) processed++;
      else failed++;
    } catch (error) {
      log.error(
        { jobId: job.id, error },
        'deletion job threw during reconcile'
      );
      failed++;
    }
  }

  return { processed, failed };
};
