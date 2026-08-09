import { afterEach, describe, expect, it } from 'bun:test';
import { Route } from './auth';

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

// Only the branches reachable before any DB write are covered here. The
// happy path (creating a user/account/session row) has no injectable db
// param - it goes through the real @/lib/db singleton directly, same
// architectural constraint already noted for lead.test.ts's rate-limit test
// and for ai-chat.ts's credit-refund path. Writing to that real shared DB
// from a unit test isn't a pattern used anywhere else in this repo; not
// introducing it here either.

const originalEnabled = process.env.LOADTEST_AUTH_ENABLED;
const originalEmail = process.env.LOADTEST_EMAIL;
const originalOtp = process.env.LOADTEST_OTP;

afterEach(() => {
  process.env.LOADTEST_AUTH_ENABLED = originalEnabled;
  process.env.LOADTEST_EMAIL = originalEmail;
  process.env.LOADTEST_OTP = originalOtp;
});

const postRequest = (body?: unknown) =>
  new Request('http://localhost/api/loadtest/auth', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  });

describe('POST /api/loadtest/auth', () => {
  it('returns 404 when LOADTEST_AUTH_ENABLED is unset', async () => {
    delete process.env.LOADTEST_AUTH_ENABLED;

    const response = await callPost(
      postRequest({ email: 'x@example.com', password: 'x' })
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when LOADTEST_AUTH_ENABLED is not exactly 'true'", async () => {
    process.env.LOADTEST_AUTH_ENABLED = 'yes';

    const response = await callPost(
      postRequest({ email: 'x@example.com', password: 'x' })
    );

    expect(response.status).toBe(404);
  });

  it('returns 400 for a malformed request body', async () => {
    process.env.LOADTEST_AUTH_ENABLED = 'true';

    const response = await callPost(
      new Request('http://localhost/api/loadtest/auth', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    expect(response.status).toBe(400);
  });

  it('returns 401 when credentials do not match LOADTEST_EMAIL/LOADTEST_OTP', async () => {
    process.env.LOADTEST_AUTH_ENABLED = 'true';
    process.env.LOADTEST_EMAIL = 'loadtest@example.com';
    process.env.LOADTEST_OTP = 'correct-password';

    const response = await callPost(
      postRequest({ email: 'loadtest@example.com', password: 'wrong' })
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 when LOADTEST_EMAIL/LOADTEST_OTP are unset', async () => {
    process.env.LOADTEST_AUTH_ENABLED = 'true';
    delete process.env.LOADTEST_EMAIL;
    delete process.env.LOADTEST_OTP;

    const response = await callPost(
      postRequest({ email: 'anything@example.com', password: 'anything' })
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 for a missing email or password field', async () => {
    process.env.LOADTEST_AUTH_ENABLED = 'true';
    process.env.LOADTEST_EMAIL = 'loadtest@example.com';
    process.env.LOADTEST_OTP = 'correct-password';

    const response = await callPost(
      postRequest({ email: 'loadtest@example.com' })
    );

    expect(response.status).toBe(401);
  });
});
