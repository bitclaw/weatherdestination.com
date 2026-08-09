#!/usr/bin/env bun
/**
 * Load test for admin-only pages (currently: /dashboard/admin/analytics).
 *
 * These pages are viewed by a handful of admins, not thousands of distinct
 * customers - the multi-tenant per-user-SQLite concern the main load test
 * pool exists for doesn't apply here. What *does* matter is the shared-DB
 * aggregation query cost (subscriptions/payments/mrr_snapshots), so this
 * runs many concurrent requests through a single authenticated admin
 * session rather than rotating through the 1000-user customer pool.
 *
 * Mints the admin session directly in the DB (same approach as
 * scripts/seed-loadtest.ts), not via a live POST to /api/loadtest/auth:
 * that endpoint has the same cookie-signing gap this file used to have
 * (see the secure-prefix and cookieCache cookie construction below) and
 * inserting directly is simpler than depending on a second server route.
 *
 * Prerequisites:
 *   1. Start the app: make dev (or bun run start:cluster for a production build)
 *   2. LOADTEST_EMAIL must be listed in ADMIN_EMAILS
 *   3. Run: bun run test:load:admin [--quick]
 */
import { base64Url } from '@better-auth/utils/base64';
import { createHMAC } from '@better-auth/utils/hmac';
import {
  checkThresholds,
  formatReport,
  loadConfig,
  runAppLoadTest
} from '@bitclaw/loadtest';
import { randomUUIDv7 } from 'bun';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE_NAME } from '@/config';
import { db } from '@/lib/db';
import { accounts, sessions, users } from '@/lib/db/schema';
import { getSecureCookiePrefix } from '@/lib/secure-cookie-prefix.server';

const COOKIE_PREFIX = getSecureCookiePrefix();
const SESSION_TOKEN_COOKIE_NAME = `${COOKIE_PREFIX}${SESSION_COOKIE_NAME}`;
const SESSION_DATA_COOKIE_NAME = `${COOKIE_PREFIX}${SESSION_COOKIE_NAME.replace(
  /\.session_token$/,
  '.session_data'
)}`;

const isQuick = process.argv.includes('--quick');

const config = await loadConfig('warpkit');

const email = process.env[config.auth.emailEnvVar];
if (!email) {
  throw new Error(`${config.auth.emailEnvVar} is not set`);
}
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error('BETTER_AUTH_SECRET not set');

const now = new Date();
let user = db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email))
  .get();
if (!user) {
  const userId = randomUUIDv7();
  db.insert(users)
    .values({
      id: userId,
      name: 'Loadtest Admin',
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
  user = { id: userId };
}

const token = randomUUIDv7();
const sessionId = randomUUIDv7();
const sessionExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
db.insert(sessions)
  .values({
    id: sessionId,
    token,
    userId: user.id,
    expiresAt: sessionExpiresAt,
    createdAt: now,
    updatedAt: now
  })
  .run();

const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
);
const sig = await crypto.subtle.sign(
  'HMAC',
  key,
  new TextEncoder().encode(token)
);
const signedValue = `${token}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
const sessionTokenCookie = `${SESSION_TOKEN_COOKIE_NAME}=${encodeURIComponent(signedValue)}`;

// cookieCache cookie, same format as scripts/seed-loadtest.ts - without it
// getSession() falls through to 2 DB SELECTs on every request regardless
// of cache config.
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
    userId: user.id,
    impersonatedBy: null
  },
  user: {
    id: user.id,
    name: 'Loadtest Admin',
    email,
    emailVerified: true,
    image: null,
    createdAt: now,
    updatedAt: now
  },
  updatedAt: Date.now(),
  version: '1'
};
const cacheSignature = await createHMAC('SHA-256', 'base64urlnopad').sign(
  secret,
  JSON.stringify({ ...sessionData, expiresAt: cacheExpiresAt })
);
const sessionDataPayload = base64Url.encode(
  JSON.stringify({
    session: sessionData,
    expiresAt: cacheExpiresAt,
    signature: cacheSignature
  }),
  { padding: false }
);
const sessionDataCookie = `${SESSION_DATA_COOKIE_NAME}=${encodeURIComponent(sessionDataPayload)}`;

const cookie = `${sessionTokenCookie}; ${sessionDataCookie}`;

const adminConfig = {
  ...config,
  publicEndpoints: [],
  authenticatedEndpoints: [
    { path: '/dashboard/admin/analytics', label: 'Admin Analytics' }
  ],
  sessionCookies: [cookie]
};

const results = await runAppLoadTest(adminConfig, isQuick ? 'quick' : 'full', {
  publicOnly: false
});

process.stdout.write(`\n${formatReport(results, adminConfig)}\n`);

const check = checkThresholds(results, config.thresholds);
if (!check.passed) {
  process.exit(1);
}
