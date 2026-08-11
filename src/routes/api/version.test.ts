import { describe, expect, it } from 'bun:test';
import { Route } from './version';

// Route.options.server.handlers.GET is the real, callable function - see
// route-workspace-scoping.test.ts's precedent (runmist/runmist) for testing
// a createFileRoute handler directly (same cast shape, since TS types
// `server.handlers` as a union with the function-factory form). No
// request/auth plumbing needed here - this route takes no params and is
// deliberately public.
const handler = (
  Route as never as {
    options: { server: { handlers: { GET: () => Response } } };
  }
).options.server.handlers.GET;

describe('GET /api/version', () => {
  it('returns 200 with a buildId field', async () => {
    const res = handler();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { buildId?: string };
    expect(typeof body.buildId).toBe('string');
  });

  it('sets Cache-Control in production - locks emission, not survival to the client (that chain is verified separately, see the plan)', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = handler();
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('does not set Cache-Control outside production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      const res = handler();
      expect(res.headers.get('Cache-Control')).toBeNull();
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
