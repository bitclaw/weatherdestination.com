import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { makeTestSharedDb } from '@/test/db';
import { createSharedRateLimiter } from './shared-rate-limiter';

describe('createSharedRateLimiter', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('blocks once the key hits max within the window', async () => {
    const db = makeTestSharedDb();
    const limiter = createSharedRateLimiter(db);
    const config = { windowMs: 60_000, max: 3 };

    for (let i = 0; i < 3; i++) {
      expect(await limiter.check('1.2.3.4', config)).toBe(false);
      await limiter.record('1.2.3.4');
    }

    expect(await limiter.check('1.2.3.4', config)).toBe(true);
  });

  it('isolates counts by key', async () => {
    const db = makeTestSharedDb();
    const limiter = createSharedRateLimiter(db);
    const config = { windowMs: 60_000, max: 1 };

    await limiter.record('1.2.3.4');
    expect(await limiter.check('1.2.3.4', config)).toBe(true);
    expect(await limiter.check('5.6.7.8', config)).toBe(false);
  });

  it('ignores events older than the window', async () => {
    const db = makeTestSharedDb();
    const limiter = createSharedRateLimiter(db);

    await limiter.record('1.2.3.4');
    // Negative window means "since" is in the future relative to the
    // just-recorded event, so it's already outside the window.
    expect(await limiter.check('1.2.3.4', { windowMs: -60_000, max: 1 })).toBe(
      false
    );
  });

  it('is a no-op outside production', async () => {
    process.env.NODE_ENV = 'test';
    const db = makeTestSharedDb();
    const limiter = createSharedRateLimiter(db);
    const config = { windowMs: 60_000, max: 1 };

    await limiter.record('1.2.3.4');
    await limiter.record('1.2.3.4');
    expect(await limiter.check('1.2.3.4', config)).toBe(false);
  });
});
