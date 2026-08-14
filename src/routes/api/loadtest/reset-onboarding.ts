import { createFileRoute } from '@tanstack/react-router';
import { eq } from 'drizzle-orm';
import { invalidateBootstrapCache } from '@/server/functions/bootstrap';

// Flips a test user back to onboardingComplete: false between test runs,
// so e2e/tests/auth/onboarding-redirect.spec.ts can exercise the real
// not-yet-onboarded flow without needing a fresh signup every time. The
// /api/loadtest/auth endpoint always creates users with
// onboardingComplete: true (except the standing onboarding-test user, which
// it creates as false but would otherwise never reset back to false on
// subsequent logins) - this is the only way to get a user back into that
// state on demand.
export const Route = createFileRoute('/api/loadtest/reset-onboarding')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env.LOADTEST_AUTH_ENABLED !== 'true') {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }

        const { db } = await import('@/lib/db');
        const { users } = await import('@/lib/db/schema');

        let body: { email?: string; password?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        // Same credential check as its sibling /api/loadtest/auth - this
        // endpoint used to accept an arbitrary email with no credential at
        // all, letting anyone who could reach it (e.g. LOADTEST_AUTH_ENABLED
        // left on in a deployed environment) force-reset any user's
        // onboarding state by email.
        const { timingSafeEqual, createHash } = await import('node:crypto');
        const digest = (value: string) =>
          createHash('sha256').update(value).digest();
        const matches = (provided: string | undefined, expected?: string) =>
          !!provided &&
          !!expected &&
          timingSafeEqual(digest(provided), digest(expected));

        const { email, password } = body;
        const authorized =
          (matches(email, process.env.LOADTEST_ONBOARDING_EMAIL) &&
            matches(password, process.env.LOADTEST_ONBOARDING_OTP)) ||
          (matches(email, process.env.LOADTEST_EMAIL) &&
            matches(password, process.env.LOADTEST_OTP));
        if (!email || !password || !authorized) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .get();

        if (!user) {
          return Response.json({ error: 'user not found' }, { status: 404 });
        }

        db.update(users)
          .set({ onboardingComplete: false, updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .run();

        invalidateBootstrapCache(user.id);

        return Response.json({ ok: true });
      }
    }
  }
});
