# Rate Limiting

Warpkit includes an IP-based, in-memory rate limiter for server functions and API routes. It is disabled outside production: dev and test run unthrottled.

## Usage in a server function

```ts
import { ERROR_CODES } from '@/lib/constants';
import { createRateLimiter } from '@/server/rate-limit';

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export const myFn = createServerFn({ method: 'POST' }).handler(async () => {
  if (limiter.check())
    return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
  // ...
});
```

Create one limiter per endpoint: each has its own store.

## Usage in a server route

```ts
import { getClientIP } from '@/server/rate-limit';

const ip = getClientIP({
  'cf-connecting-ip': request.headers.get('cf-connecting-ip') ?? undefined,
  'x-real-ip': request.headers.get('x-real-ip') ?? undefined,
  'x-forwarded-for': request.headers.get('x-forwarded-for') ?? undefined,
});

if (limiter.check(ip ?? undefined)) {
  return Response.json({ error: 'Too many requests' }, { status: 429 });
}
```

## IP detection: TRUST_PROXY

`getClientIP` does NOT walk a priority chain. It reads exactly ONE header,
selected by the `TRUST_PROXY` env var, because trusting a header your proxy
does not actually set lets clients spoof their IP and bypass rate limits:

| `TRUST_PROXY` | Header trusted |
|---------------|----------------|
| `cloudflare` (default) | `cf-connecting-ip` |
| `nginx` | `x-real-ip` |
| `proxy` | `x-forwarded-for` (first IP) |
| `none` | no header , every request keys to `'unknown'` |

Set it to match your actual deployment topology (see `.env.example`). Falls
back to `'unknown'` when the selected header is absent; the limiter is
disabled entirely outside production.

## Config options

| Option | Type | Description |
|--------|------|-------------|
| `windowMs` | number | Window duration in milliseconds |
| `max` | number | Max requests allowed per window |

## Memory management

The store auto-cleans expired entries every 5 minutes. There is no persistent storage: limits reset on server restart.

---

## Per-user DB-backed rate limiting

For authenticated mutations, use `checkUserRateLimit` from `@/lib/db/user-rate-limiter`. This counts `user_events` rows for a given event type within a sliding window and is backed by per-user SQLite, so limits survive server restarts.

```ts
import { checkUserRateLimit } from '@/lib/db/user-rate-limiter';
import { logUserEvent } from '@/lib/db/user-events';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';

export const createItem = createServerFn({ method: 'POST' }).handler(async () => {
  const user = await requireUser();
  if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

  return withWriteLock(user.id, () => {
    const db = getUserDb(user.id);
    if (checkUserRateLimit(db, 'item.created', { windowMs: 60_000, max: 20 }))
      return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');

    // ... write logic ...
    logUserEvent(db, 'item.created');
    return ok({ id });
  });
});
```

Both `checkUserRateLimit` and `logUserEvent` must be called inside `withWriteLock`. `checkUserRateLimit` reads event count and is a no-op outside `NODE_ENV=production` (so local dev/test never throttles). `logUserEvent` always runs regardless of `NODE_ENV` , it's the audit trail future checks (and future rate-limit windows) depend on, not just a rate-limit input.

**When to use which limiter:**

| Scenario | Limiter |
|----------|---------|
| Unauthenticated endpoint (public API, lead capture) | `createRateLimiter` (IP-based) |
| Authenticated mutation by signed-in user | `checkUserRateLimit` (per-user DB) |
| Both (defense in depth) | Use both: IP gate before lock, user gate inside lock |

## Two-tier pattern (IP then user)

The most common shape in this codebase, used at 10+ call sites (`account.mutations.ts`, `account.queries.ts`, `admin.mutations.ts`, etc.): an IP-based limiter gates *before* `requireUser()` runs, so an unauthenticated caller can't force a session lookup, and a second per-user limiter gates *after* `requireUser()` succeeds, so users behind a shared NAT/proxy don't share one IP-keyed budget:

```ts
const ipLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
const userLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export const myFn = createServerFn({ method: 'POST' }).handler(async () => {
  if (ipLimiter.check()) return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
  const user = await requireUser();
  if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
  if (userLimiter.check(user.id))
    return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
  // ...
});
```

Both limiters here are the IP-based `createRateLimiter`, just keyed differently (no key vs. `user.id`) , this is distinct from combining `createRateLimiter` with `checkUserRateLimit`, which is its own defense-in-depth combination (see table above).

See also: [Gate ordering](../patterns/gate-ordering.md) for correct placement of rate-limit checks relative to `withWriteLock`.
