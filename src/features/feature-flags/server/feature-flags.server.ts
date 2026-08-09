import { err, ok, type Result } from '@bitclaw/result';
import { TTLCache } from '@bitclaw/sqlite/ttl-cache';
import { randomUUIDv7 } from 'bun';
import { eq } from 'drizzle-orm';
import { ERROR_CODES } from '@/lib/constants';
import type { db as SharedDb } from '@/lib/db';
import { featureFlags } from '@/lib/db/schema';

type Db = typeof SharedDb;

const globalForFlags = globalThis as unknown as {
  _flagCache?: TTLCache<boolean>;
};

export type FeatureFlagRecord = {
  id: string;
  flag: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date | null;
};

const flagCache =
  globalForFlags._flagCache ??
  new TTLCache<boolean>({ ttl: 30_000, maxSize: 200 });

if (process.env.NODE_ENV !== 'production') {
  globalForFlags._flagCache = flagCache;
}

export const getFlagEnabled = async (
  db: Db,
  flag: string
): Promise<boolean> => {
  const cached = flagCache.get(flag);
  if (cached !== undefined) return cached;

  const row = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.flag, flag),
    columns: { enabled: true }
  });
  const enabled = row?.enabled ?? false;
  flagCache.set(flag, enabled);
  return enabled;
};

// One-line early check for server functions gating an optional/demo
// feature - mirrors requireUser()/requireAdmin()'s style (explicit
// per-function check, not middleware) so it reads the same way at every
// call site. NOT_FOUND rather than FORBIDDEN: a disabled feature should
// look absent, not like a permissions wall the caller could reasonably
// expect to get past.
export const requireFeatureFlagEnabled = async (
  db: Db,
  flag: string
): Promise<Result<true>> => {
  const enabled = await getFlagEnabled(db, flag);
  if (!enabled) {
    return err(ERROR_CODES.NOT_FOUND, 'This feature is not enabled.');
  }
  return ok(true);
};

export const listFlags = async (db: Db): Promise<FeatureFlagRecord[]> => {
  return db.select().from(featureFlags).orderBy(featureFlags.flag);
};

export const upsertFlag = async (db: Db, flag: string, enabled: boolean) => {
  const now = new Date();

  // Sync transaction (see CLAUDE.md "Shared-DB Transactions Must Use Sync
  // Callbacks"): makes the check-then-write atomic, so two concurrent
  // upserts of the same new flag can't both see "not found" and both
  // attempt an insert.
  const result = db.transaction(tx => {
    const existing = tx.query.featureFlags
      .findFirst({
        where: eq(featureFlags.flag, flag),
        columns: { id: true }
      })
      .sync();

    if (existing) {
      tx.update(featureFlags)
        .set({ enabled, updatedAt: now })
        .where(eq(featureFlags.flag, flag))
        .run();
      return { id: existing.id, flag, enabled };
    }

    const id = randomUUIDv7();
    tx.insert(featureFlags)
      .values({ id, flag, enabled, createdAt: now, updatedAt: now })
      .run();
    return { id, flag, enabled };
  });

  flagCache.set(flag, enabled);
  return ok(result);
};

export const removeFlag = async (db: Db, flag: string) => {
  await db.delete(featureFlags).where(eq(featureFlags.flag, flag));
  flagCache.delete(flag);
  return ok({ deleted: true });
};

/** Test-only: reset the module-level cache between tests. */
export const clearFlagCache = () => flagCache.clear();
