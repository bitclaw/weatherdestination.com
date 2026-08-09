# Session Cache

`src/server/session-cache.ts` dedupes `auth.api.getSession()` calls within a single request. `requireUser()`, `requireAdmin()`, and `bootstrap.ts` each need the session; without this, a typical page load would verify the session (real HMAC/crypto + DB cost) once per caller.

## The cache key is the `Headers` object's identity, not its contents

```ts
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
```

`WeakMap` keys on object identity. Two `Headers` instances with identical cookies are different keys and will not share a cache entry.

**Always call with `getRequestHeaders()`**, which returns the same `Headers` instance for the lifetime of the current request:

```ts
// RIGHT , same Headers instance every call within this request, cache hits
import { getRequestHeaders } from '@tanstack/react-start/server';
const session = await getCachedSession(getRequestHeaders());
```

```ts
// WRONG , fresh Headers instance, cache always misses, defeats the whole point
const session = await getCachedSession(new Headers({ cookie: someCookieString }));
```

A cache miss isn't a correctness bug (it just calls `getSession` again), but it silently reintroduces the per-call cost this file exists to remove. If you're adding a new call site and it doesn't have an obvious `getRequestHeaders()` available, that's a sign the call is happening somewhere unexpected (outside request context) , check that first rather than constructing a `Headers` object to satisfy the type.

## In-flight promise, not just the resolved value

The map stores the `Promise<Session>`, not the awaited result, so concurrent calls that start before the first resolves also dedupe. A plain `WeakMap<object, Session>` only catches sequential calls within a request.

## Tests: inject `getSession`, don't mock the module

The second parameter is a DI seam for tests, not `bun:test`'s `mock()`/`spyOn()`:

```ts
// require-gates.test.ts pattern
const session = await getCachedSession(new Headers(), async () => fakeSession);
```

`mock.module()` on `auth.api.getSession` leaks process-wide across test files with no reliable way to undo it (see the `testing` skill's note on Bun's shared-process test model). The param-injection pattern predates this cache and still works unchanged , keep using it for new tests that need a fake session.
