import { Scheduler } from '@bitclaw/jobs';
import { getJobQueue } from '@/features/jobs/queue.server';
import type { AppJobs } from '@/features/jobs/types';

export const SCHEDULES: Array<{
  name: string;
  type: keyof AppJobs;
  cron: string;
  data: Record<string, never>;
  overlap: boolean;
}> = [
  {
    name: 'reengagement-scan',
    type: 'email:reengagement-scan',
    cron: '0 9 * * *',
    data: {},
    overlap: false
  },
  {
    name: 'reconcile-deletions',
    type: 'account:reconcile-deletions',
    cron: '*/15 * * * *',
    data: {},
    overlap: false
  },
  {
    name: 'snapshot-mrr',
    type: 'analytics:snapshot-mrr',
    // Daily rather than monthly: idempotent per calendar month (upserts on
    // the unique `month` key), so running daily just keeps the current
    // month's snapshot fresh throughout the month instead of only writing
    // once at a fixed date that could be missed by downtime.
    cron: '0 1 * * *',
    data: {},
    overlap: false
  }
];

// Creates a per-request Scheduler bound to the current job queue.
// Registers all schedules so the admin page shows the full list before first tick.
export const getScheduler = (): Scheduler<AppJobs> => {
  const scheduler = new Scheduler(getJobQueue());
  for (const s of SCHEDULES) {
    scheduler.register(s.name, s.type, s.cron, {
      data: s.data,
      overlap: s.overlap
    });
  }
  return scheduler;
};

let tickTimer: ReturnType<typeof setInterval> | null = null;

const runTick = (): void => {
  try {
    const scheduler = getScheduler();
    scheduler.cleanup(SCHEDULES.map(s => s.name));
    const enqueued = scheduler.tick();
    if (enqueued > 0) {
      console.info(`[schedule] Enqueued ${enqueued} job(s)`);
    }
  } catch (error: unknown) {
    console.error(
      '[schedule] tick error:',
      error instanceof Error ? error.message : String(error)
    );
  }
};

export const startScheduler = (): void => {
  if (tickTimer) return;
  runTick();
  tickTimer = setInterval(runTick, 60_000);
  console.info(
    `[schedule] Started scheduler (${SCHEDULES.length} schedule(s))`
  );
};

export const stopScheduler = (): void => {
  if (!tickTimer) return;
  clearInterval(tickTimer);
  tickTimer = null;
};
