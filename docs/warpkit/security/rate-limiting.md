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
| `cloudflare` | `cf-connecting-ip` |
| `nginx` | `x-real-ip` |
| `proxy` | `x-forwarded-for` (first IP) |
| `none` (default) | no header , every request keys to `'unknown'` |

**The default is `none`, not `cloudflare`** , deliberately, since most of
this template's own deploy recipes (Docker, Fly.io, Railway) don't put
Cloudflare in front by default. Set it to match your actual deployment
topology (see `.env.example`'s `TRUST_PROXY` section for the full spoofing
warning) , if your app is proxied through Cloudflare, set `TRUST_PROXY=cloudflare`
or every request collapses onto the same `'unknown'` key.

### `failClosedOnUnknownIp`

```ts
const limiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  failClosedOnUnknownIp: true
});
```

When true, a request with no resolvable client IP (`getClientIP()` returns
`null`, no explicit key passed) is **blocked outright** instead of falling
into the shared `'unknown'` bucket. Without this, a `TRUST_PROXY`
misconfiguration (or the `none` default) collapses every caller into one
global budget , fine for a low-stakes limiter, dangerous for anything
auth-adjacent, where one attacker exhausting the shared bucket locks out
every real user. Used today by `email-validation.mutations.ts` and
`admin.mutations.ts`.

This flag lives on `createRateLimiter` (in-memory) only. The DB-backed
`shared-rate-limiter.ts` below doesn't have it , code using that limiter
implements the same fail-closed check manually at the call site (see
`login-otp.ts`/`signup-otp.ts` below), gated to production only so it
doesn't also block local dev, where `TRUST_PROXY` is unset by default and
`getClientIP()` is always `null`.

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
| Unauthenticated endpoint, single-worker-safe (public API, lead capture) | `createRateLimiter` (in-memory, IP-based) |
| Unauthenticated endpoint that must hold across `cluster.ts` worker processes (auth-adjacent: OTP send, magic-link) | `shared-rate-limiter.ts` (DB-backed, IP-based) |
| Authenticated mutation by signed-in user | `checkUserRateLimit` (per-user DB) |
| Both (defense in depth) | Use both: IP gate before lock, user gate inside lock |

## Cross-process IP-based limiting: `shared-rate-limiter.ts`

`createRateLimiter`'s in-memory `Map` only tracks state within a single
`cluster.ts` worker process , if the app runs `availableParallelism()`
worker processes (the default production entrypoint, see
`docs/warpkit/features/background-jobs.md`), an attacker round-robins
across workers behind the same reverse proxy and gets ~N× the intended
budget before any single worker's counter trips. For endpoints where the
rate limit is a load-bearing defense , not just noise reduction , that gap
matters. `src/lib/db/shared-rate-limiter.ts` fixes it by backing the
counter with the shared meta DB (`rate_limit_events` table) instead of a
process-local `Map`:

```ts
import {
  checkSharedRateLimit,
  recordSharedRateLimitEvent,
  isActive
} from '@/lib/db/shared-rate-limiter';
import { getClientIP } from '@/server/rate-limit';

const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, max: 3 };

export const myFn = createServerFn({ method: 'POST' }).handler(async () => {
  const ip = getClientIP();

  // Fail closed in production only - see failClosedOnUnknownIp above for
  // why this must not run in dev, where getClientIP() is always null.
  if (!ip && isActive()) {
    return err(ERROR_CODES.RATE_LIMITED, 'Too many requests. Please try again later.');
  }

  const key = ip ?? 'unknown';
  if (await checkSharedRateLimit(key, RATE_LIMIT_CONFIG)) {
    return err(ERROR_CODES.RATE_LIMITED, 'Too many requests. Please try again later.');
  }
  await recordSharedRateLimitEvent(key);

  // ... handler logic ...
});
```

`checkSharedRateLimit`/`recordSharedRateLimitEvent`/`isActive` are the same
production-only-gated shape as `createRateLimiter` and `checkUserRateLimit`
, no-op outside `NODE_ENV=production`. Unlike `createRateLimiter`, this
limiter has no `failClosedOnUnknownIp` option built in; callers implement
the fail-closed check themselves at the top of the handler (as above) so
they control the exact error returned.

**Real usage**: `src/server/functions/login-otp.ts` and `signup-otp.ts`.
Both wrap `auth.api.sendVerificationOTP` directly instead of going through
`authClient`'s real HTTP endpoint, which means better-auth's own router-level
`rateLimit.customRules` (configured in `src/server/auth.ts`) never fires for
these calls , `auth.api.*` bypasses the router entirely. The DB-backed
limiter here is what actually protects the OTP-send endpoint; it isn't
redundant with the `customRules` config in `auth.ts`, despite both targeting
the same nominal path.

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
