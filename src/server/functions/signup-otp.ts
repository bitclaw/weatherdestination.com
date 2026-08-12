import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import { config } from '@/config';
import { ERROR_CODES } from '@/lib/constants';
import {
  checkSharedRateLimit,
  isActive,
  recordSharedRateLimitEvent
} from '@/lib/db/shared-rate-limiter';
import { getClientIP } from '@/server/rate-limit';

// Mirrors the existing 3/60s window from auth.ts's
// customRules['/email-otp/send-verification-otp'] - keep in sync if that
// ever changes. See login-otp.ts's own comment for why this needs
// reimplementing at all: auth.api.* bypasses better-auth's router(), which
// is where both the captcha plugin and this rate limit normally run.
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, max: 3 };

const schema = z.object({
  email: z.string().email().min(1).max(254)
});

/**
 * Signup OTP send, routed through a thin wrapper instead of calling
 * authClient.emailOtp.sendVerificationOtp (better-auth's real HTTP
 * endpoint) directly, for one reason: fail-open Turnstile. better-auth's
 * captcha plugin hard-rejects any request missing x-captcha-response with
 * no option to make that optional, so a widget that never got a chance to
 * run (blocked script, load timeout) would permanently dead-end a real
 * signup. See shouldProceedWithoutBlocking's doc comment for the
 * fail-open reasoning. The token itself still travels via the
 * x-captcha-response header (same as before), read server-side here.
 *
 * Unlike login's sendLoginOtp, this has no existence to hide - signup is
 * supposed to always attempt a real send - so real errors (rate limit,
 * failed captcha) are surfaced via a normal Result instead of always
 * resolving ok().
 *
 * The OTP *verify* step (src/pages/signup/index.tsx's verifyOtp) is
 * deliberately left untouched, calling authClient.signIn.emailOtp
 * directly - a createServerFn wrapper around it can't set the browser's
 * session cookie.
 */
export const sendSignupOtp = createServerFn({ method: 'POST' })
  .validator(schema)
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const ip = getClientIP();

    // Fail closed per-request in production only - see login-otp.ts's
    // identical comment for why this must not run in dev (TRUST_PROXY
    // defaults to 'none' there, so ip is always null). Conflates a
    // TRUST_PROXY misconfig with real rate-limiting for the client, which
    // is a deliberate tradeoff: there's no honest message here that isn't
    // either scary or itself enumeration-relevant.
    if (!ip && isActive()) {
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Please try again later.'
      );
    }

    const rateLimitKey = ip ?? 'unknown';
    if (await checkSharedRateLimit(rateLimitKey, RATE_LIMIT_CONFIG)) {
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Please try again later.'
      );
    }
    await recordSharedRateLimitEvent(rateLimitKey);

    if (config.auth.turnstile.enabled) {
      const { shouldProceedWithoutBlocking, verifyTurnstileToken } =
        await import('@/features/captcha/verify-turnstile.server');
      const token = getRequestHeaders().get('x-captcha-response') ?? undefined;
      const hasToken = !!token;
      const verified = hasToken
        ? await verifyTurnstileToken(token!, ip ?? undefined)
        : true;
      if (!shouldProceedWithoutBlocking(hasToken, verified)) {
        return err(
          ERROR_CODES.VERIFY_FAILED,
          'Security challenge failed. Please try again.'
        );
      }
    }

    try {
      const { auth } = await import('@/server/auth');
      await auth.api.sendVerificationOTP({
        body: { email, type: 'sign-in' },
        headers: getRequestHeaders()
      });
      return ok({ sent: true });
    } catch (caught: unknown) {
      return err(
        ERROR_CODES.INTERNAL,
        caught instanceof Error ? caught.message : 'Failed to send code'
      );
    }
  });
