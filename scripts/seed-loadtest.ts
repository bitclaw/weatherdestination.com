#!/usr/bin/env bun
/**
 * Seed 1000 loadtest users (USER_COUNT), each with their own per-user SQLite DB.
 * Writes signed session cookies to data/loadtest-sessions.json.
 * Idempotent: safe to re-run (users are find-or-created, sessions always fresh).
 *
 * Usage:
 *   bun scripts/seed-loadtest.ts
 *   make loadtest.seed
 */

import path from 'node:path';
import { base64Url } from '@better-auth/utils/base64';
import { createHMAC } from '@better-auth/utils/hmac';
import { randomUUIDv7 } from 'bun';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE_NAME } from '@/config';
import { db } from '@/lib/db';
import {
  accounts,
  mrrSnapshots,
  payments,
  sessions,
  subscriptions,
  users
} from '@/lib/db/schema';
import { getUserDb } from '@/lib/db/user-db';
import { getSecureCookiePrefix } from '@/lib/secure-cookie-prefix.server';

// Matches better-auth's default generateId(): createRandomStringGenerator('a-z',
// 'A-Z', '0-9')(32) - see node_modules/@better-auth/core/src/utils/id.ts. Real
// user IDs are alphanumeric, not UUIDs; admin.mutations.ts's userIdSchema
// validates the userId field against this shape, so the user row's id must
// match it. Other id fields below use randomUUIDv7() instead - those are
// never passed through userIdSchema, only referenced as foreign keys.
const ALPHANUMERIC =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const generateUserId = () =>
  Array.from(
    { length: 32 },
    () => ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)]
  ).join('');

// Under a production build (NODE_ENV=production, the default for
// `bun run start`/`start:cluster`), better-auth prefixes every session
// cookie with `__Secure-` - see getSecureCookiePrefix for why. Without this,
// auth.api.getSession() never finds the cookie at all (not a DB-visibility
// issue, not cross-worker - the cookie name itself never matches) and every
// "authenticated" request in a prod-build load test silently 307s to
// /login, which @bitclaw/loadtest then follows and reports as a 200
// success. See docs/warpkit/performance.md's cross-worker-session-visibility
// correction for the full story.
const COOKIE_PREFIX = getSecureCookiePrefix();
const SESSION_TOKEN_COOKIE_NAME = `${COOKIE_PREFIX}${SESSION_COOKIE_NAME}`;

// better-auth's cookieCache cookie ("session_data"), sibling to the
// session_token cookie above. Without this cookie, auth.api.getSession()
// always falls through to two DB SELECTs (sessions + users) on every
// request, cache HIT or not - see docs/warpkit/performance.md, "2026-07-19" entry:
// every prior load-test run in that doc paid this cost because seeded
// sessions never carried it. Format replicated from
// node_modules/better-auth/dist/cookies/index.mjs (setCookieCache /
// getCookieCache, "compact" strategy, the default).
const SESSION_DATA_COOKIE_NAME = `${COOKIE_PREFIX}${SESSION_COOKIE_NAME.replace(
  /\.session_token$/,
  '.session_data'
)}`;
// The embedded expiresAt below is signed by this script, not derived from
// auth.ts's live cookieCache.maxAge (5 min) - better-auth only checks it
// against Date.now(), there's no cross-check against the app's configured
// value. A 5-minute window would go stale before `make loadtest.seed` ->
// benchmark-run even finishes, since the load-test harness replays this
// same static cookie for the whole run and never processes a refreshed
// Set-Cookie. Match the session's own 30-day expiry instead so it stays
// valid for the seed-to-benchmark gap.

// Same DATABASE_PATH resolution as src/lib/db/index.ts, so the sessions file
// always lands next to the DB it actually describes - not silently in cwd's
// data/ regardless of DATABASE_PATH, which clobbers a real session pool the
// moment this script is run against an overridden/scratch DATABASE_PATH.
const dbPath =
  process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'data', 'meta.db');
const sessionsPath = path.join(path.dirname(dbPath), 'loadtest-sessions.json');

const USER_COUNT = 1000;
const EMAIL_DOMAIN = 'test.loadtest.internal';

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error('BETTER_AUTH_SECRET not set');

const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
);

const cookies: string[] = [];

for (let i = 1; i <= USER_COUNT; i++) {
  const email = `loadtest-${i}@${EMAIL_DOMAIN}`;
  const now = new Date();

  let existingUser = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!existingUser) {
    const userId = generateUserId();
    db.insert(users)
      .values({
        id: userId,
        name: `Loadtest User ${i}`,
        email,
        emailVerified: true,
        onboardingComplete: true,
        createdAt: now,
        updatedAt: now
      })
      .run();
    db.insert(accounts)
      .values({
        id: randomUUIDv7(),
        accountId: userId,
        providerId: 'email',
        userId,
        createdAt: now,
        updatedAt: now
      })
      .run();
    existingUser = { id: userId };
  }

  // Always create a fresh session (token validity matters more than deduplication)
  const token = randomUUIDv7();
  const sessionId = randomUUIDv7();
  const sessionExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  db.insert(sessions)
    .values({
      id: sessionId,
      token,
      userId: existingUser.id,
      expiresAt: sessionExpiresAt,
      createdAt: now,
      updatedAt: now
    })
    .run();

  // Sign cookie -- same logic as src/routes/api/loadtest/auth.ts
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(token)
  );
  const signedValue = `${token}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
  const sessionTokenCookie = `${SESSION_TOKEN_COOKIE_NAME}=${encodeURIComponent(signedValue)}`;

  // Sign the cookieCache ("session_data") cookie so getSession() hits the
  // signed-cookie fast path instead of the DB, same as a real interactive
  // login. sessionData mirrors setCookieCache's shape exactly (session,
  // user, updatedAt, version), and the outer envelope's key order must
  // match too: getCookieCache recomputes the HMAC over
  // JSON.stringify({...parsedSession, expiresAt}) after round-tripping
  // through JSON, so object literal key order here has to match what it
  // reconstructs on read.
  const cacheExpiresAt = sessionExpiresAt.getTime();
  const sessionData = {
    session: {
      id: sessionId,
      expiresAt: sessionExpiresAt,
      token,
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
      userId: existingUser.id,
      impersonatedBy: null
    },
    user: {
      id: existingUser.id,
      name: `Loadtest User ${i}`,
      email,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now
    },
    updatedAt: Date.now(),
    version: '1'
  };
  const signature = await createHMAC('SHA-256', 'base64urlnopad').sign(
    secret,
    JSON.stringify({ ...sessionData, expiresAt: cacheExpiresAt })
  );
  const sessionDataPayload = base64Url.encode(
    JSON.stringify({
      session: sessionData,
      expiresAt: cacheExpiresAt,
      signature
    }),
    { padding: false }
  );
  const sessionDataCookie = `${SESSION_DATA_COOKIE_NAME}=${encodeURIComponent(sessionDataPayload)}`;

  cookies.push(`${sessionTokenCookie}; ${sessionDataCookie}`);

  // Trigger per-user DB migration so first load-test request doesn't pay cold migration cost
  getUserDb(existingUser.id);

  // Give roughly a third of users an active subscription across the three
  // paid plans, so the admin analytics dashboard's MRR/plan-distribution/
  // recent-payments queries aggregate real rows under load instead of
  // measuring an empty-table best case.
  if (i % 3 === 0) {
    const plan = (['solo', 'pro', 'team'] as const)[i % 3];
    const existingSub = db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.userId, existingUser.id))
      .get();
    if (!existingSub) {
      const subId = randomUUIDv7();
      db.insert(subscriptions)
        .values({
          id: subId,
          userId: existingUser.id,
          stripeCustomerId: `cus_loadtest_${i}`,
          plan,
          status: 'active',
          currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          createdAt: now,
          updatedAt: now
        })
        .run();
      db.insert(payments)
        .values({
          id: randomUUIDv7(),
          userId: existingUser.id,
          stripeInvoiceId: `in_loadtest_${i}`,
          stripeCustomerId: `cus_loadtest_${i}`,
          plan,
          amount: plan === 'solo' ? 900 : plan === 'pro' ? 2900 : 7900,
          currency: 'usd',
          createdAt: now
        })
        .run();
    }
  }

  if (i % 10 === 0) {
    process.stdout.write(`  ${i}/${USER_COUNT} users seeded...\n`);
  }
}

// Backfill 3 months of MRR snapshots so the trend chart has history to plot,
// not just today's live number.
const currentMonth = new Date();
for (let m = 2; m >= 0; m--) {
  const monthDate = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - m,
    1
  );
  const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const existingSnapshot = db
    .select({ id: mrrSnapshots.id })
    .from(mrrSnapshots)
    .where(eq(mrrSnapshots.month, month))
    .get();
  if (!existingSnapshot) {
    // Rough approximation scaled down for earlier months, just to give the
    // trend chart non-flat history - not a claim of real historical MRR.
    const scale = 1 - m * 0.15;
    db.insert(mrrSnapshots)
      .values({
        id: randomUUIDv7(),
        month,
        mrr: Math.round(333 * 2900 * scale),
        activeSubscribers: Math.round(333 * scale),
        createdAt: monthDate
      })
      .run();
  }
}

await Bun.write(sessionsPath, JSON.stringify(cookies, null, 2));
process.stdout.write(
  `\nSeeded ${USER_COUNT} loadtest users -> ${sessionsPath}\n`
);
