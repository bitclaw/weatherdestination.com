import { describe, expect, it } from 'bun:test';
import { getTurnstileProtectedEndpoints } from './turnstile-endpoints';

describe('getTurnstileProtectedEndpoints', () => {
  it('protects the OTP send endpoint when verificationMethod is otp', () => {
    expect(getTurnstileProtectedEndpoints('otp')).toEqual([
      '/email-otp/send-verification-otp'
    ]);
  });

  it('protects the magic-link endpoint when verificationMethod is magic-link', () => {
    expect(getTurnstileProtectedEndpoints('magic-link')).toEqual([
      '/sign-in/magic-link'
    ]);
  });

  it('protects both endpoints when verificationMethod is both', () => {
    expect(getTurnstileProtectedEndpoints('both')).toEqual([
      '/email-otp/send-verification-otp',
      '/sign-in/magic-link'
    ]);
  });

  it("never returns better-auth's password-auth defaults", () => {
    // Regression guard for the actual production bug: better-auth's
    // captcha plugin defaults to /sign-up/email, /sign-in/email,
    // /request-password-reset -- paths this passwordless app never hits,
    // which is why siteverify was never being called in production
    // (confirmed via Cloudflare's dashboard) despite the plugin being
    // registered and the widget issuing real tokens client-side.
    const passwordAuthDefaults = [
      '/sign-up/email',
      '/sign-in/email',
      '/request-password-reset'
    ];
    for (const method of ['otp', 'magic-link', 'both'] as const) {
      const endpoints = getTurnstileProtectedEndpoints(method);
      for (const defaultPath of passwordAuthDefaults) {
        expect(endpoints).not.toContain(defaultPath);
      }
    }
  });
});
