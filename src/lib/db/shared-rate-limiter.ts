import { randomUUIDv7 } from 'bun';
import { and, count, eq, gte, lt } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/bun-sqlite';
import { db as sharedDb } from './index';
import type * as schema from './schema';
import { rateLimitEvents } from './schema';

type Config = {
  windowMs: number;
  max: number;
};

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const PRUNE_OLDER_THAN_MS = 24 * 60 * 60 * 1000;
// Prune on a small fraction of writes rather than every write or on an
// interval - cheap way to bound table growth without adding new infra (same
// spirit as createRateLimiter's own CLEANUP_INTERVAL).
const PRUNE_PROBABILITY = 0.01;

export const isActive = (): boolean =>
  process.env.NODE_ENV === 'production' &&
  process.env.TSS_PRERENDERING !== 'true';

/**
 * Cross-process-safe rate limiter for endpoints with no per-user DB to key
 * against (pre-auth / fully public - IP-keyed). Backed by the shared meta
 * DB, which every cluster.ts worker already reads/writes, unlike
 * createRateLimiter's in-memory Map, which only tracks state within a
 * single worker process.
 *
 * Factory instead of a module-level singleton so tests can point this at an
 * isolated makeTestSharedDb() instead of the real shared meta DB.
 */
export function createSharedRateLimiter(db: DrizzleDb) {
  /** Only active in production, same as checkUserRateLimit. */
  const check = async (key: string, config: Config): Promise<boolean> => {
    if (!isActive()) return false;

    const since = new Date(Date.now() - config.windowMs);
    const [row] = await db
      .select({ value: count() })
      .from(rateLimitEvents)
      .where(
        and(eq(rateLimitEvents.key, key), gte(rateLimitEvents.createdAt, since))
      );

    return (row?.value ?? 0) >= config.max;
  };

  /**
   * Record an attempt against `key`. Call at gate time (right after the
   * check passes, before the guarded action runs) not only on success -
   * counts attempts, not successes.
   *
   * Gated the same as check() so dev/test runs don't accumulate rows this
   * function exists solely to feed the limiter.
   */
  const record = async (key: string): Promise<void> => {
    if (!isActive()) return;

    await db.insert(rateLimitEvents).values({
      id: randomUUIDv7(),
      key,
      createdAt: new Date()
    });

    if (Math.random() < PRUNE_PROBABILITY) {
      await db
        .delete(rateLimitEvents)
        .where(
          lt(
            rateLimitEvents.createdAt,
            new Date(Date.now() - PRUNE_OLDER_THAN_MS)
          )
        );
    }
  };

  return { check, record };
}

const sharedLimiter = createSharedRateLimiter(sharedDb);

export const checkSharedRateLimit = sharedLimiter.check;
export const recordSharedRateLimitEvent = sharedLimiter.record;
