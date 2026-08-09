import { afterEach, describe, expect, it } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { mswServer } from '@/test/msw/server';
import { contactSchema, Route } from './contact';

// TanStack Router's `handlers` type is a union of an object literal and a
// factory function, so TS can't narrow `.POST` statically even though the
// runtime shape is always the object literal here (same cast as
// src/routes/api/v1/lead.test.ts).
const callPost = (request: Request) =>
  (
    Route.options.server as unknown as {
      handlers: { POST: (opts: { request: Request }) => Promise<Response> };
    }
  ).handlers.POST({ request });

const originalNodeEnv = process.env.NODE_ENV;
const originalTurnstileSecret = process.env.TURNSTILE_SECRET_KEY;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.TURNSTILE_SECRET_KEY = originalTurnstileSecret;
});

// Same short-circuit reasoning as lead.test.ts: the sendEmail() branch has
// no injectable dependency, so these tests exercise the handler's defenses
// (malformed JSON, rate limit, Turnstile) which all return before reaching
// that branch, rather than the real email-send path.
describe('POST /api/v1/contact', () => {
  it('returns 400 for a malformed request body', async () => {
    const response = await callPost(
      new Request('http://localhost/api/v1/contact', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 for an invalid payload', async () => {
    const response = await callPost(
      new Request('http://localhost/api/v1/contact', {
        method: 'POST',
        body: JSON.stringify({ name: '', email: 'not-an-email', message: '' }),
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
      new Request('http://localhost/api/v1/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alice',
          email: 'test@example.com',
          message: 'Hello, I need some help with this.',
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
    const testIp = `contact-rate-limit-test-${crypto.randomUUID()}`;
    const makeRequest = () =>
      callPost(
        new Request('http://localhost/api/v1/contact', {
          method: 'POST',
          // Malformed on purpose: the rate limiter runs before JSON
          // parsing, so this never reaches the sendEmail() branch even
          // though it still consumes the limiter's count for this IP.
          body: 'not json',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': testIp
          }
        })
      );

    let lastResponse: Response | undefined;
    // Limiter is configured with max: 20 in contact.ts - the 21st request
    // for the same IP should trip it.
    for (let i = 0; i < 21; i++) {
      lastResponse = await makeRequest();
    }

    expect(lastResponse?.status).toBe(429);
  });
});

// Regression test: NoCaptchaProvider's captcha token is `null`, not
// undefined (VITE_TURNSTILE_SITE_KEY is unset out of the box, so this is the
// default path on a fresh clone). A schema using .optional() instead of
// .nullish() only accepts undefined and rejects null, breaking every
// contact submission by default.
describe('contactSchema', () => {
  const valid = {
    name: 'Alice',
    email: 'test@example.com',
    message: 'This is a valid message with enough length.'
  };

  it('accepts a valid payload', () => {
    const result = contactSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts a null turnstileToken (Turnstile disabled)', () => {
    const result = contactSchema.safeParse({ ...valid, turnstileToken: null });
    expect(result.success).toBe(true);
  });

  it('accepts a missing turnstileToken', () => {
    const result = contactSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('lowercases the email', () => {
    const result = contactSchema.safeParse({
      ...valid,
      email: 'Test@Example.com'
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('test@example.com');
  });

  it('rejects an invalid email', () => {
    const result = contactSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing name', () => {
    const result = contactSchema.safeParse({ ...valid, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a message under the minimum length', () => {
    const result = contactSchema.safeParse({ ...valid, message: 'short' });
    expect(result.success).toBe(false);
  });
});
