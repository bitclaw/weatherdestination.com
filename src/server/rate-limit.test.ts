import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createRateLimiter, getClientIP } from './rate-limit';

// ---------------------------------------------------------------------------
// createRateLimiter
// ---------------------------------------------------------------------------

describe('createRateLimiter', () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it('allows requests up to max', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.check('k')).toBe(false);
    expect(limiter.check('k')).toBe(false);
    expect(limiter.check('k')).toBe(false);
  });

  it('blocks on request exceeding max', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    limiter.check('k');
    limiter.check('k');
    expect(limiter.check('k')).toBe(true);
  });

  it('tracks keys independently', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.check('a');
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('b')).toBe(false);
  });

  it('resets after window expires', () => {
    const limiter = createRateLimiter({ windowMs: 1, max: 1 });
    limiter.check('k');
    expect(limiter.check('k')).toBe(true);

    return new Promise<void>(resolve =>
      setTimeout(() => {
        expect(limiter.check('k')).toBe(false);
        resolve();
      }, 10)
    );
  });

  it('never blocks outside production', () => {
    process.env.NODE_ENV = 'test';
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    for (let i = 0; i < 100; i++) limiter.check('k');
    expect(limiter.check('k')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getClientIP
// ---------------------------------------------------------------------------

describe('getClientIP', () => {
  let originalTrustProxy: string | undefined;

  beforeEach(() => {
    originalTrustProxy = process.env.TRUST_PROXY;
  });

  afterEach(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = originalTrustProxy;
    }
  });

  describe('cloudflare mode (default)', () => {
    beforeEach(() => {
      process.env.TRUST_PROXY = 'cloudflare';
    });

    it('returns cf-connecting-ip', () => {
      expect(
        getClientIP({
          'cf-connecting-ip': '1.1.1.1',
          'x-real-ip': '2.2.2.2',
          'x-forwarded-for': '3.3.3.3'
        })
      ).toBe('1.1.1.1');
    });

    it('returns null when cf-connecting-ip absent', () => {
      expect(
        getClientIP({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' })
      ).toBeNull();
    });
  });

  describe('nginx mode', () => {
    beforeEach(() => {
      process.env.TRUST_PROXY = 'nginx';
    });

    it('returns x-real-ip', () => {
      expect(
        getClientIP({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' })
      ).toBe('2.2.2.2');
    });

    it('returns null when x-real-ip absent', () => {
      expect(getClientIP({ 'x-forwarded-for': '3.3.3.3' })).toBeNull();
    });
  });

  describe('proxy mode', () => {
    beforeEach(() => {
      process.env.TRUST_PROXY = 'proxy';
    });

    it('returns first x-forwarded-for entry', () => {
      expect(getClientIP({ 'x-forwarded-for': '3.3.3.3, 4.4.4.4' })).toBe(
        '3.3.3.3'
      );
    });

    it('returns null when x-forwarded-for absent', () => {
      expect(getClientIP({})).toBeNull();
    });
  });

  describe('none mode', () => {
    beforeEach(() => {
      process.env.TRUST_PROXY = 'none';
    });

    it('always returns null', () => {
      expect(
        getClientIP({
          'cf-connecting-ip': '1.1.1.1',
          'x-real-ip': '2.2.2.2',
          'x-forwarded-for': '3.3.3.3'
        })
      ).toBeNull();
    });
  });
});
