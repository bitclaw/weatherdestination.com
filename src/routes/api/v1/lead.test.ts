import { afterEach, describe, expect, it } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { mswServer } from '@/test/msw/server';
import { leadSchema, Route } from './lead';

// TanStack Router's `handlers` type is a union of an object literal and a
// factory function, so TS can't narrow `.POST` statically even though the
// runtime shape is always the object literal here (same cast as
// src/routes/api/v1/ai-chat.test.ts).
const callPost = (request: Request) =>
  (
    Route.options.server as unknown as {
      handlers: { POST: (opts: { request: Request }) => Promise<Response> };
    }
  ).handlers.POST({ request });

const originalNodeEnv = process.env.NODE_ENV;
const originalFeatureLeads = process.env.FEATURE_LEADS;
const originalTurnstileSecret = process.env.TURNSTILE_SECRET_KEY;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.FEATURE_LEADS = originalFeatureLeads;
  process.env.TURNSTILE_SECRET_KEY = originalTurnstileSecret;
});

// These exercise the real route handler (not just leadSchema in isolation),
// closing the gap flagged in the 2026-07-21 convention audit: none of the
// handler's actual defenses (rate limit, Turnstile, feature-flag gate,
// malformed JSON) were previously covered. Each test below is deliberately
// constructed to short-circuit BEFORE the DB-insert branch (which has no
// injectable `db` param, unlike the billing webhook handlers - see
// stripe-refund.server.ts - so it isn't safely testable against the real
// shared DB here) - malformed JSON / a disabled flag / a tripped rate limit
// / a rejected Turnstile token all return before ever reaching that branch.
describe('POST /api/v1/lead', () => {
  it('returns 404 when the leads feature flag is disabled', async () => {
    process.env.FEATURE_LEADS = 'false';

    const response = await callPost(
      new Request('http://localhost/api/v1/lead', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' }
      })
    );

    expect(response.status).toBe(404);
  });

  it('returns 400 for a malformed request body', async () => {
    const response = await callPost(
      new Request('http://localhost/api/v1/lead', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    expect(response.status).toBe(400);
  });

  it('returns 403 when Turnstile verification fails', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    mswServer.use(
      http.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        () => HttpResponse.json({ success: false })
      )
    );

    const response = await callPost(
      new Request('http://localhost/api/v1/lead', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          turnstileToken: 'bad-token'
        }),
        headers: { 'Content-Type': 'application/json' }
      })
    );

    expect(response.status).toBe(403);
  });

  it('returns 429 once the per-IP rate limit is exceeded', async () => {
    // createRateLimiter's check() is a no-op outside production - see
    // src/server/rate-limit.ts:36.
    process.env.NODE_ENV = 'production';

    // The limiter's store is a module-scope singleton with no test-facing
    // reset and only a 5-minute passive cleanup (rate-limit.ts:25-31) - a
    // fixed IP here would leak count across repeat runs of this test in the
    // same bun:test process. Unique IP per run avoids relying on that
    // cleanup ever firing.
    const testIp = `lead-rate-limit-test-${crypto.randomUUID()}`;
    const makeRequest = () =>
      callPost(
        new Request('http://localhost/api/v1/lead', {
          method: 'POST',
          // Malformed on purpose: the rate limiter runs before JSON
          // parsing, so this never reaches the DB-insert branch even
          // though it still consumes the limiter's count for this IP.
          body: 'not json',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': testIp
          }
        })
      );

    let lastResponse: Response | undefined;
    // Limiter is configured with max: 20 in lead.ts - the 21st request for
    // the same IP should trip it.
    for (let i = 0; i < 21; i++) {
      lastResponse = await makeRequest();
    }

    expect(lastResponse?.status).toBe(429);
  });
});

// Regression test: NoCaptchaProvider's captcha token is `null`, not
// undefined (VITE_TURNSTILE_SITE_KEY is unset out of the box, so this is the
// default path on a fresh clone). A schema using .optional() instead of
// .nullish() only accepts undefined and rejects null, breaking every lead
// submission by default.
describe('leadSchema', () => {
  it('accepts a null turnstileToken (Turnstile disabled)', () => {
    const result = leadSchema.safeParse({
      email: 'test@example.com',
      turnstileToken: null
    });
    expect(result.success).toBe(true);
  });

  it('accepts a missing turnstileToken', () => {
    const result = leadSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  it('accepts a real turnstileToken string', () => {
    const result = leadSchema.safeParse({
      email: 'test@example.com',
      turnstileToken: 'a-real-token'
    });
    expect(result.success).toBe(true);
  });

  it('lowercases the email', () => {
    const result = leadSchema.safeParse({ email: 'Test@Example.com' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('test@example.com');
  });

  it('rejects an invalid email', () => {
    const result = leadSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });
});
