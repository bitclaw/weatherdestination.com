import { createFileRoute } from '@tanstack/react-router';
import { randomUUIDv7 } from 'bun';
import { SESSION_COOKIE_NAME } from '@/config';

// Matches better-auth's default generateId(): createRandomStringGenerator('a-z',
// 'A-Z', '0-9')(32) - see node_modules/@better-auth/core/src/utils/id.ts. Real
// user IDs are alphanumeric, not UUIDs; admin.mutations.ts's userIdSchema
// validates the userId field against this shape, so the user row's id must
// match it. accounts.id/sessions.id below use randomUUIDv7() instead - those
// are never passed through userIdSchema, only referenced as foreign keys.
const ALPHANUMERIC =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const generateUserId = () =>
  Array.from(
    { length: 32 },
    () => ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)]
  ).join('');

export const Route = createFileRoute('/api/loadtest/auth')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // NOT a NODE_ENV==='production' guard: Nitro's built server sets
        // NODE_ENV to 'production' by default any time it's run from a
        // build (bun run start / start:cluster), including the documented
        // local perf-testing workflow (docs/warpkit/performance.md) - it can't
        // distinguish that from a real deployment, so gating on it here
        // would permanently break the endpoint's own reason to exist while
        // adding no real protection (a real deployment has the identical
        // NODE_ENV value). LOADTEST_AUTH_ENABLED is the actual gate: it
        // defaults unset/off (see .env.example) and must be deliberately
        // set to 'true' to enable this endpoint at all.
        if (process.env.LOADTEST_AUTH_ENABLED !== 'true') {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }

        const { eq } = await import('drizzle-orm');
        const { db } = await import('@/lib/db');
        const { accounts, sessions, users } = await import('@/lib/db/schema');
        const { timingSafeEqual, createHash } = await import('node:crypto');

        let body: { email?: string; password?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        // Hash both sides to a fixed-length digest before comparing: avoids
        // leaking credential length via timingSafeEqual's length check, and
        // sidesteps it entirely if either env var is unset.
        const digest = (value: string) =>
          createHash('sha256').update(value).digest();
        const matches = (provided: string | undefined, expected?: string) =>
          !!provided &&
          !!expected &&
          timingSafeEqual(digest(provided), digest(expected));

        const { email, password } = body;
        // Second credential pair for a standing "not yet onboarded" test
        // user - e2e/tests/auth/onboarding-redirect.spec.ts logs in as this
        // user and calls /api/loadtest/reset-onboarding before each
        // assertion, rather than every other loadtest-authenticated test
        // (which all expect onboardingComplete: true) needing to fight over
        // one shared user's onboarding state.
        const isOnboardingUser =
          matches(email, process.env.LOADTEST_ONBOARDING_EMAIL) &&
          matches(password, process.env.LOADTEST_ONBOARDING_OTP);
        if (
          !email ||
          !password ||
          !(
            isOnboardingUser ||
            (matches(email, process.env.LOADTEST_EMAIL) &&
              matches(password, process.env.LOADTEST_OTP))
          )
        ) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let user = db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(eq(users.email, email))
          .get();

        if (!user) {
          const now = new Date();
          const userId = generateUserId();

          // Playwright runs spec files in parallel workers, and every spec's
          // beforeEach calls this endpoint - against a freshly wiped e2e DB, two
          // workers can both land here with no existing row. onConflictDoNothing
          // + re-select makes this race safe instead of throwing on the email
          // unique constraint (surfaced as an unhandled 500 to whichever worker
          // lost).
          db.insert(users)
            .values({
              id: userId,
              name: isOnboardingUser ? 'Onboarding Test User' : 'Loadtest User',
              email,
              emailVerified: true,
              onboardingComplete: !isOnboardingUser,
              createdAt: now,
              updatedAt: now
            })
            .onConflictDoNothing()
            .run();

          user = db
            .select({ id: users.id, email: users.email, name: users.name })
            .from(users)
            .where(eq(users.email, email))
            .get()!;

          db.insert(accounts)
            .values({
              id: randomUUIDv7(),
              accountId: user.id,
              providerId: 'email',
              userId: user.id,
              createdAt: now,
              updatedAt: now
            })
            .onConflictDoNothing()
            .run();
        } else if (!isOnboardingUser) {
          // Ensure onboardingComplete is set for pre-existing users (e.g.
          // created before this field was required). Skipped for the
          // onboarding test user - reset-onboarding.ts is what's supposed
          // to control that user's onboarding state between test runs;
          // forcing it true on every login here would undo that reset
          // before the test ever gets to assert anything.
          db.update(users)
            .set({ onboardingComplete: true, updatedAt: new Date() })
            .where(eq(users.id, user.id))
            .run();
        }

        const sessionToken = randomUUIDv7();
        const now = new Date();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;

        db.insert(sessions)
          .values({
            id: randomUUIDv7(),
            token: sessionToken,
            userId: user.id,
            expiresAt: new Date(now.getTime() + thirtyDays),
            createdAt: now,
            updatedAt: now
          })
          .run();

        // better-auth uses signed cookies: encodeURIComponent(`${token}.${base64(HMAC-SHA256(token, secret))}`)
        const secret = process.env.BETTER_AUTH_SECRET!;
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
          new TextEncoder().encode(sessionToken)
        );
        const signedValue = `${sessionToken}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
        const cookieValue = encodeURIComponent(signedValue);

        // Under a production build, better-auth requires the `__Secure-`
        // cookie prefix - see getSecureCookiePrefix. Without it, this
        // cookie silently never matches what auth.api.getSession() reads,
        // and every subsequent authenticated request 307s to /login.
        const { getSecureCookiePrefix } = await import(
          '@/lib/secure-cookie-prefix.server'
        );
        const securePrefix = getSecureCookiePrefix();
        const cookieName = `${securePrefix}${SESSION_COOKIE_NAME}`;
        // Secure whenever the prod-shaped __Secure- prefix applies (same
        // condition getSecureCookiePrefix already uses) - previously always
        // omitted, so a prod build with an http:// BETTER_AUTH_URL (no
        // prefix, see getSecureCookiePrefix's own comment) issued this
        // 30-day session cookie without Secure, i.e. sendable over
        // plaintext HTTP.
        const cookie = `${cookieName}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${securePrefix ? '; Secure' : ''}`;

        return new Response(
          JSON.stringify({
            user: { id: user.id, email: user.email, name: user.name },
            session: { token: sessionToken }
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': cookie
            }
          }
        );
      }
    }
  }
});
