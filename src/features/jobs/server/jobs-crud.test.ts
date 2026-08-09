import { describe, expect, it } from 'bun:test';
import { JobQueue, NonRetryableError } from '@bitclaw/jobs';
import type { AppJobs } from '../types';

const waitUntil = async (
  condition: () => boolean,
  timeoutMs = 2000,
  intervalMs = 10
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitUntil: timed out');
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
};

describe('jobs', () => {
  it('enqueues and processes a job', async () => {
    const queue = new JobQueue<AppJobs>(':memory:');
    try {
      let processed = false;

      const worker = queue.createWorker({
        type: 'email:welcome',
        handler: async () => {
          processed = true;
        },
        pollIntervalMs: 30
      });
      worker.start();
      queue.add('email:welcome', {
        userId: 'user_1',
        email: 'test@test.com',
        name: 'Test'
      });

      await waitUntil(() => processed);
      await worker.stop();
      expect(processed).toBe(true);
    } finally {
      queue.close();
    }
  });

  it('passes correct payload to handler', async () => {
    const queue = new JobQueue<AppJobs>(':memory:');
    try {
      let captured: Record<string, unknown> | null = null;

      const worker = queue.createWorker<'email:trial-expiring'>({
        type: 'email:trial-expiring',
        handler: async job => {
          captured = job.data as Record<string, unknown>;
        },
        pollIntervalMs: 30
      });
      worker.start();
      queue.add('email:trial-expiring', {
        userId: 'user_1',
        email: 'user@test.com',
        name: 'User',
        daysLeft: 3
      });

      await waitUntil(() => captured !== null);
      await worker.stop();

      expect(captured).toMatchObject({ email: 'user@test.com', daysLeft: 3 });
    } finally {
      queue.close();
    }
  });

  it('returns a numeric job id on enqueue', async () => {
    const queue = new JobQueue<AppJobs>(':memory:');
    try {
      const id = queue.add('email:welcome', {
        userId: 'user_1',
        email: 'id@test.com',
        name: 'Id'
      });
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    } finally {
      queue.close();
    }
  });

  it('enqueues with AppJobs type safety', async () => {
    // Compile-time check: these should type-check without errors
    const queue = new JobQueue<AppJobs>(':memory:');
    try {
      const ids = [
        queue.add('email:welcome', {
          userId: 'user_1',
          email: 'a@b.com',
          name: 'A'
        }),
        queue.add('email:onboarding-day3', {
          userId: 'user_1',
          email: 'a@b.com',
          name: 'A'
        }),
        queue.add('email:onboarding-day7', {
          userId: 'user_1',
          email: 'a@b.com',
          name: 'A'
        }),
        queue.add('email:reengagement', {
          userId: 'user_1',
          email: 'a@b.com',
          name: 'A'
        }),
        queue.add('email:trial-expiring', {
          userId: 'user_1',
          email: 'a@b.com',
          name: 'A',
          daysLeft: 3
        })
      ];
      for (const id of ids) {
        expect(typeof id).toBe('number');
        expect(id).toBeGreaterThan(0);
      }
    } finally {
      queue.close();
    }
  });

  it('NonRetryableError moves job to dead-letter immediately, no retries', async () => {
    const queue = new JobQueue<AppJobs>(':memory:');
    try {
      let attempts = 0;

      const worker = queue.createWorker({
        type: 'email:welcome',
        handler: async () => {
          attempts++;
          throw new NonRetryableError('Permanent failure');
        },
        pollIntervalMs: 30
      });
      worker.start();
      queue.add(
        'email:welcome',
        { userId: 'user_1', email: 'test@test.com', name: 'Test' },
        { maxRetries: 5 }
      );

      await waitUntil(
        () => queue.getFailedJobs({ type: 'email:welcome' }).items.length > 0
      );
      await worker.stop();

      expect(attempts).toBe(1);
      const failed = queue.getFailedJobs({ type: 'email:welcome' });
      expect(failed.items.length).toBe(1);
    } finally {
      queue.close();
    }
  });

  it('job moves to dead-letter after maxRetries exhaustion', async () => {
    const queue = new JobQueue<AppJobs>(':memory:');
    try {
      let attempts = 0;

      const worker = queue.createWorker({
        type: 'email:welcome',
        handler: async () => {
          attempts++;
          throw new Error('Transient failure');
        },
        pollIntervalMs: 30
      });
      worker.start();
      // maxRetries=0 → single attempt, then dead-letter , deterministic, no backoff wait needed
      queue.add(
        'email:welcome',
        { userId: 'user_1', email: 'test@test.com', name: 'Test' },
        { maxRetries: 0 }
      );

      await waitUntil(
        () => queue.getFailedJobs({ type: 'email:welcome' }).items.length > 0
      );
      await worker.stop();

      expect(attempts).toBe(1);
      const failed = queue.getFailedJobs({ type: 'email:welcome' });
      expect(failed.items.length).toBe(1);
    } finally {
      queue.close();
    }
  });
});
