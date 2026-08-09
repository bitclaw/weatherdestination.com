import { auth } from '@/server/auth';

export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
export type GetSessionFn = (opts: { headers: Headers }) => Promise<Session>;

// Shared across every request-scoped session check (requireUser,
// requireAdmin, bootstrap) so a single request pays for
// auth.api.getSession()'s real HMAC/crypto + DB cost once, no matter how
// many of these run during that request's loaders/server functions. Before
// this existed, requireUser, requireAdmin, and bootstrap.ts each called
// auth.api.getSession() directly, so a typical page load verified the
// session three times - a real, CPU-bound cost that scales with
// concurrency (see runmist's docs/runmist/performance.md, which caught this
// via a real-hardware load test after this exact duplication was ported in
// from here).
//
// Caches the in-flight Promise, not just the resolved value, so concurrent
// calls that start before the first resolves also dedupe - a plain
// WeakMap<object, Session> only catches sequential calls within a request.
//
// Takes an optional getSession override (defaulting to the real
// auth.api.getSession) so callers keep their own existing DI seam for
// tests (see require-gates.test.ts's asUser() - this file deliberately
// doesn't use bun:test's mock()/spyOn() for auth.api.getSession, which
// leaked process-wide across test files with no way to fully undo it; the
// param-injection pattern predates this cache and still works unchanged).
const sessionCache = new WeakMap<object, Promise<Session>>();

export const getCachedSession = (
  headers: Headers,
  getSession: GetSessionFn = opts => auth.api.getSession(opts)
): Promise<Session> => {
  let session = sessionCache.get(headers);
  if (!session) {
    session = getSession({ headers });
    sessionCache.set(headers, session);
  }
  return session;
};
