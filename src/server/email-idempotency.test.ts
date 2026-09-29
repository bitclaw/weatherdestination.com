import { describe, expect, it } from 'bun:test';
import { idempotencyKeyFor, runInEmailIdempotencyScope } from './email';

describe('email idempotency key', () => {
  it('is undefined outside a job scope', () => {
    expect(idempotencyKeyFor({ to: 'a@x.com', subject: 'Hi' })).toBeUndefined();
  });

  it('is stable for the same job + email, so a rerun is deduped by Resend', async () => {
    const first = await runInEmailIdempotencyScope(
      'email:welcome:7',
      async () => idempotencyKeyFor({ to: 'a@x.com', subject: 'Hi' })
    );
    const rerun = await runInEmailIdempotencyScope(
      'email:welcome:7',
      async () => idempotencyKeyFor({ to: 'a@x.com', subject: 'Hi' })
    );
    expect(first).toStartWith('email:welcome:7:');
    expect(rerun).toBe(first);
  });

  it('differs per recipient/subject within one job and across jobs', async () => {
    const keys = await runInEmailIdempotencyScope(
      'email:receipt:9',
      async () => [
        idempotencyKeyFor({ to: 'a@x.com', subject: 'Hi' }),
        idempotencyKeyFor({ to: 'b@x.com', subject: 'Hi' }),
        idempotencyKeyFor({ to: 'a@x.com', subject: 'Other' })
      ]
    );
    const otherJob = await runInEmailIdempotencyScope(
      'email:receipt:10',
      async () => idempotencyKeyFor({ to: 'a@x.com', subject: 'Hi' })
    );
    expect(new Set([...keys, otherJob]).size).toBe(4);
  });
});
