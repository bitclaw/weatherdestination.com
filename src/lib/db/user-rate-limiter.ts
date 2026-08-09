import type { Database } from 'bun:sqlite';

type Config = {
  windowMs: number;
  max: number;
};

/**
 * Count-based rate limiter backed by user_events table.
 * Returns true if the user has exceeded `max` events of `eventType`
 * within the last `windowMs` milliseconds.
 *
 * Only active in production , always returns false in dev/test or during
 * vite build's own prerender crawl (see src/server/rate-limit.ts's header
 * comment for why TSS_PRERENDERING, not just NODE_ENV).
 * Call before logUserEvent so the count reflects completed events.
 */
export const checkUserRateLimit = (
  db: Database,
  eventType: string,
  config: Config
): boolean => {
  if (process.env.NODE_ENV !== 'production') return false;
  if (process.env.TSS_PRERENDERING === 'true') return false;

  const since = Date.now() - config.windowMs;
  const row = db
    .query<{ count: number }, [string, number]>(
      'SELECT COUNT(*) as count FROM user_events WHERE type = ? AND created_at >= ?'
    )
    .get(eventType, since);

  return (row?.count ?? 0) >= config.max;
};
