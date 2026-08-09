import crypto from 'node:crypto';
import { randomUUIDv7 } from 'bun';
import { and, eq, gt } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/bun-sqlite';
import { db as globalDb } from '@/lib/db';
import type * as schema from '@/lib/db/schema';
import { trialAbuseMarkers } from '@/lib/db/schema';

const MARKER_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// One-way fingerprint, not a password store - the threat model is "does
// this email match a marker we already wrote," not resisting offline
// brute-force of a low-entropy secret, so a plain sha256 + salt is enough
// (no need for scrypt/bcrypt/argon2's deliberate slowness). Reuses
// BETTER_AUTH_SECRET as the salt source rather than requiring a dedicated
// env var - every deployment already sets this.
const hashEmail = (email: string): string => {
  const salt = process.env.BETTER_AUTH_SECRET;
  if (!salt) throw new Error('BETTER_AUTH_SECRET is required');
  return crypto
    .createHash('sha256')
    .update(`${salt}:${email.trim().toLowerCase()}`)
    .digest('hex');
};

type Tx = Parameters<Parameters<(typeof globalDb)['transaction']>[0]>[0];

// Call from INSIDE the same sync transaction that deletes the user row
// (account-deletion.server.ts's "POINT OF NO RETURN" step) - the email is
// gone from `users` after that step, so this is the only point it can still
// be captured.
export const recordTrialAbuseMarker = (tx: Tx, email: string): void => {
  const now = new Date();
  tx.insert(trialAbuseMarkers)
    .values({
      id: randomUUIDv7(),
      hashedEmail: hashEmail(email),
      deletedAt: now,
      expiresAt: new Date(now.getTime() + MARKER_LIFETIME_MS),
      createdAt: now
    })
    .onConflictDoUpdate({
      target: trialAbuseMarkers.hashedEmail,
      set: {
        deletedAt: now,
        expiresAt: new Date(now.getTime() + MARKER_LIFETIME_MS)
      }
    })
    .run();
};

export const hasUsedTrialBefore = async (
  email: string,
  dbOverride?: ReturnType<typeof drizzle<typeof schema>>
): Promise<boolean> => {
  const d = dbOverride ?? globalDb;
  const marker = await d.query.trialAbuseMarkers.findFirst({
    where: and(
      eq(trialAbuseMarkers.hashedEmail, hashEmail(email)),
      gt(trialAbuseMarkers.expiresAt, new Date())
    )
  });
  return marker !== undefined;
};
