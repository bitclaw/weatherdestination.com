import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { mswServer } from '@/test/msw/server';
import { verifyTurnstileToken } from './verify-turnstile.server';

describe('verifyTurnstileToken', () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = originalSecret;
    }
  });

  it('returns true unconditionally when TURNSTILE_SECRET_KEY is unset', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const result = await verifyTurnstileToken('any-token');
    expect(result).toBe(true);
  });

  describe('when configured', () => {
    beforeEach(() => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    });

    it('returns true when Cloudflare reports success', async () => {
      // Covered by the default handler in src/test/msw/handlers.ts, but
      // asserted explicitly here since this is the happy path this file
      // exists to verify.
      const result = await verifyTurnstileToken('valid-token', '1.2.3.4');
      expect(result).toBe(true);
    });

    it('returns false when Cloudflare reports failure', async () => {
      mswServer.use(
        http.post(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          () => HttpResponse.json({ success: false })
        )
      );
      const result = await verifyTurnstileToken('invalid-token');
      expect(result).toBe(false);
    });

    it('returns false when the siteverify request itself fails', async () => {
      mswServer.use(
        http.post(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          () => HttpResponse.json({}, { status: 500 })
        )
      );
      const result = await verifyTurnstileToken('any-token');
      expect(result).toBe(false);
    });

    it('returns false instead of hanging when Cloudflare never responds', async () => {
      mswServer.use(
        http.post(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          () => new Promise(() => {}) // never resolves
        )
      );
      const result = await verifyTurnstileToken('any-token', undefined, 50);
      expect(result).toBe(false);
    });
  });
});
