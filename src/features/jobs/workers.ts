import { handleReconcileDeletions } from '@/features/jobs/handlers/account-reconcile-deletions';
import { handleSnapshotMrr } from '@/features/jobs/handlers/analytics-snapshot-mrr';
import { handleOnboardingDay3 } from '@/features/jobs/handlers/email-onboarding-day3';
import { handleOnboardingDay7 } from '@/features/jobs/handlers/email-onboarding-day7';
import { handleReceiptEmail } from '@/features/jobs/handlers/email-receipt';
import { handleReengagement } from '@/features/jobs/handlers/email-reengagement';
import { handleReengagementScan } from '@/features/jobs/handlers/email-reengagement-scan';
import { handleTrialExpiring } from '@/features/jobs/handlers/email-trial-expiring';
import { handleWelcomeEmail } from '@/features/jobs/handlers/email-welcome';
import { withEmailPreferenceGate } from '@/features/jobs/handlers/with-email-preference-gate';
import { getJobQueue } from '@/features/jobs/queue.server';
import {
  startScheduler,
  stopScheduler
} from '@/features/jobs/scheduler.server';
import { createLogger } from '@/lib/logger';

const log = createLogger({ module: 'jobs' });

type Stoppable = { start(): void; stop(): Promise<void> };
const workers: Stoppable[] = [];

const WORKER_OPTS = {
  pollIntervalMs: 1000,
  maxRate: { count: 10, windowMs: 60_000 }
};

export const startWorkers = (): void => {
  if (workers.length > 0) return;
  const queue = getJobQueue();

  // Reset jobs a crashed/killed worker left stuck in "processing" back to
  // "pending" so they get picked up again instead of being lost forever.
  const reconciled = queue.reconcileStaleJobs();
  if (reconciled > 0) log.info({ reconciled }, 'reset stale processing jobs');

  workers.push(
    queue.createWorker({
      type: 'email:welcome',
      handler: handleWelcomeEmail,
      ...WORKER_OPTS
    }),
    queue.createWorker({
      type: 'email:onboarding-day3',
      handler: withEmailPreferenceGate(
        'marketing_emails',
        handleOnboardingDay3
      ),
      ...WORKER_OPTS
    }),
    queue.createWorker({
      type: 'email:onboarding-day7',
      handler: withEmailPreferenceGate(
        'marketing_emails',
        handleOnboardingDay7
      ),
      ...WORKER_OPTS
    }),
    // Ungated (unlike onboarding/reengagement below) - this communicates an
    // impending loss of paid access, not a promotional nudge, so it isn't
    // opt-out-able via the marketing_emails preference.
    queue.createWorker({
      type: 'email:trial-expiring',
      handler: handleTrialExpiring,
      ...WORKER_OPTS
    }),
    queue.createWorker({
      type: 'email:reengagement',
      handler: withEmailPreferenceGate('marketing_emails', handleReengagement),
      ...WORKER_OPTS
    }),
    queue.createWorker({
      type: 'email:receipt',
      handler: handleReceiptEmail,
      ...WORKER_OPTS
    }),
    queue.createWorker({
      type: 'email:reengagement-scan',
      handler: handleReengagementScan,
      ...WORKER_OPTS
    }),
    queue.createWorker({
      type: 'account:reconcile-deletions',
      handler: handleReconcileDeletions,
      ...WORKER_OPTS
    }),
    queue.createWorker({
      type: 'analytics:snapshot-mrr',
      handler: handleSnapshotMrr,
      ...WORKER_OPTS
    })
  );

  for (const worker of workers) {
    worker.start();
  }

  log.info(`Started ${workers.length} workers`);
  startScheduler();
};

const SHUTDOWN_TIMEOUT_MS = 10_000;

export const stopWorkers = async (): Promise<void> => {
  if (workers.length === 0) return;
  stopScheduler();

  // stop() waits for in-flight jobs to drain with no timeout of its own - a
  // hung handler (e.g. a stuck network call) would otherwise block graceful
  // shutdown indefinitely. Bounding it here means shutdown always proceeds;
  // the platform's own kill signal is the backstop for a truly stuck job.
  const timeout = new Promise<void>(resolve => {
    setTimeout(() => {
      log.warn(
        { timeoutMs: SHUTDOWN_TIMEOUT_MS },
        'worker shutdown timed out, proceeding anyway'
      );
      resolve();
    }, SHUTDOWN_TIMEOUT_MS).unref();
  });

  await Promise.race([Promise.all(workers.map(w => w.stop())), timeout]);
  workers.length = 0;
};
