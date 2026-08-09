import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  spyOn
} from 'bun:test';
import {
  removeFlag,
  upsertFlag
} from '@/features/feature-flags/server/feature-flags.server';
import { db } from '@/lib/db';
import { auth } from '@/server/auth';
import { Route } from './ai-chat';

// The route now gates on the ai_chat_enabled flag before any of the
// behavior this file exercises (CSRF, auth, payload validation, rate
// limiting) - flags default off, so without this every test below would
// see 404 instead of the status it's actually testing for.
//
// `db` here is the real shared DB, not an isolated test fixture (this
// file's pre-existing convention - the route itself uses the real module,
// no DI seam) - .env.test doesn't override DATABASE_PATH, so this is the
// same file local dev/production use. Without the afterAll cleanup below,
// running this suite once leaves ai_chat_enabled permanently ON outside
// the test run.
beforeAll(async () => {
  await upsertFlag(db, 'ai_chat_enabled', true);
});

afterAll(async () => {
  await removeFlag(db, 'ai_chat_enabled');
});

// validateChatMessages itself is covered directly in
// src/features/ai-chat/server/ai-chat-crud.test.ts:107-155 - this file only
// exercises the route-level branches, none of which reach chat()/the SSE
// stream, so no MSW/stream mocking is needed.

// TanStack Router's `handlers` type is a union of an object literal and a
// factory function, so TS can't narrow `.POST` statically even though the
// runtime shape is always the object literal here (confirmed via
// `typeof Route.options.server.handlers.POST === 'function'`).
const callPost = (request: Request) =>
  (
    Route.options.server as unknown as {
      handlers: { POST: (opts: { request: Request }) => Promise<Response> };
    }
  ).handlers.POST({ request });

// spyOn (not a bare `auth.api.getSession = mock(...)` overwrite) - the route
// calls auth.api.getSession directly with no DI seam to inject through, and
// `mock.restore()` in afterEach only reverts spyOn()-created mocks, not a
// bare property overwrite. A bare overwrite here would stay monkey-patched
// for every test file that runs afterward in the same bun:test process (see
// require-gates.test.ts for the equivalent fix via constructor injection,
// not available here since this file exercises the route handler itself).
const asUser = (userId: string | null) => {
  spyOn(auth.api, 'getSession').mockImplementation((() =>
    Promise.resolve(
      userId ? ({ user: { id: userId, email: 'u@test.com' } } as never) : null
    )) as never);
};

const originalApiKey = process.env.OPENROUTER_API_KEY;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  mock.restore();
  process.env.OPENROUTER_API_KEY = originalApiKey;
  process.env.NODE_ENV = originalNodeEnv;
});

// Same-origin by default (Origin header matching the request URL) - every
// test below exercises logic that runs AFTER the same-origin check, so it
// needs to pass that check first. The check's own rejection behavior is
// covered separately below.
const postRequest = (body?: unknown) =>
  new Request('http://localhost/api/v1/ai-chat', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost'
    }
  });

describe('POST /api/v1/ai-chat', () => {
  it('returns 403 when the Origin header does not match the request origin', async () => {
    asUser('user_cross_origin');
    process.env.OPENROUTER_API_KEY = 'test-key';

    const response = await callPost(
      new Request('http://localhost/api/v1/ai-chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [] }),
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example.com'
        }
      })
    );

    expect(response.status).toBe(403);
  });

  it('returns 403 when no Origin, Sec-Fetch-Site, or Referer header is present', async () => {
    asUser('user_no_origin');
    process.env.OPENROUTER_API_KEY = 'test-key';

    const response = await callPost(
      new Request('http://localhost/api/v1/ai-chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [] }),
        headers: { 'Content-Type': 'application/json' }
      })
    );

    expect(response.status).toBe(403);
  });

  it('returns 401 when there is no session', async () => {
    asUser(null);
    process.env.OPENROUTER_API_KEY = 'test-key';

    const response = await callPost(postRequest({ messages: [] }));

    expect(response.status).toBe(401);
  });

  it('returns 503 when OPENROUTER_API_KEY is not configured', async () => {
    asUser('user_1');
    delete process.env.OPENROUTER_API_KEY;

    const response = await callPost(postRequest({ messages: [] }));

    expect(response.status).toBe(503);
  });

  it('returns 400 for a malformed request body', async () => {
    asUser('user_2');
    process.env.OPENROUTER_API_KEY = 'test-key';

    const response = await callPost(
      new Request('http://localhost/api/v1/ai-chat', {
        method: 'POST',
        body: 'not json',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost'
        }
      })
    );

    expect(response.status).toBe(400);
  });

  it('returns 429 once the per-user rate limit is exceeded', async () => {
    asUser('user_rate_limited');
    process.env.OPENROUTER_API_KEY = 'test-key';
    // createRateLimiter's check() is a no-op outside production - see
    // src/server/rate-limit.ts:34.
    process.env.NODE_ENV = 'production';

    let lastResponse: Response | undefined;
    // Limiter is configured with max: 30 in ai-chat.ts - the 31st request
    // for the same user id should trip it.
    for (let i = 0; i < 31; i++) {
      lastResponse = await callPost(postRequest({ messages: [] }));
    }

    expect(lastResponse?.status).toBe(429);
  });
});
