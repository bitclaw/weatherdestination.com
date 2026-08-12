import { ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import { config } from '@/config';
import { db } from '@/lib/db';
import {
  checkSharedRateLimit,
  isActive,
  recordSharedRateLimitEvent
} from '@/lib/db/shared-rate-limiter';
import { getClientIP } from '@/server/rate-limit';
import { shouldSendLoginOtp } from './login-otp.server';

// `auth.api.*` calls bypass better-auth's router() entirely (it only runs
// inside handler(), i.e. real HTTP requests through auth.handler()) - so
// captcha verification and better-auth's own customRules rate limiter
// (both implemented as router-level onRequest hooks) never fire for the
// direct auth.api.sendVerificationOTP call below. Both are re-implemented
// explicitly here. Mirrors the existing 3/60s window from auth.ts's
// customRules['/email-otp/send-verification-otp'] - keep in sync if that
// ever changes.
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, max: 3 };

const schema = z.object({
  email: z.string().email().min(1).max(254)
});

/**
 * Enumeration-safe login OTP send. Unlike signup (see ./signup-otp.ts,
 * which has no existence to hide and surfaces real errors), login only
 * emails a code for an email that already has an account - an unknown
 * email gets no email, no OTP record, and the exact same generic response
 * as a known one, always ok().
 *
 * Turnstile is fail-open here (see shouldProceedWithoutBlocking): a token
 * that was never produced doesn't block the send, only a token that WAS
 * provided and failed verification does. Deliberate - the widget has no
 * failure path when its own script is blocked (ad-blocker, shields), so
 * hard-gating on it would permanently dead-end real users with no token
 * and no explanation. The captcha token itself travels via the
 * x-captcha-response header on this server-fn call (same header the page
 * already builds for its old direct authClient call), not a payload field.
 *
 * The OTP *verify* step (src/pages/login/index.tsx's verifyOtp) is
 * deliberately left untouched, calling authClient.signIn.emailOtp directly
 * - a createServerFn wrapper around it can't set the browser's session
 * cookie. That's safe here because better-auth's own signInEmailOTP throws
 * the same generic INVALID_OTP error whether the code is wrong or no OTP
 * was ever created for that email - gating the send is sufficient.
 */
export const sendLoginOtp = createServerFn({ method: 'POST' })
  .validator(schema)
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const ip = getClientIP();

    // Fail closed per-request in production only (matches
    // failClosedOnUnknownIp elsewhere in this repo, and shared-rate-limiter's
    // own isActive() gate) rather than bucketing into a shared 'unknown' key -
    // a TRUST_PROXY misconfiguration must not let one caller exhaust a global
    // budget and lock out every real user's OTP send. Ungated, this would
    // also break local dev, where TRUST_PROXY defaults to 'none' and
    // getClientIP() is always null.
    if (!ip && isActive()) {
      return ok({ sent: true });
    }

    const rateLimitKey = ip ?? 'unknown';
    if (await checkSharedRateLimit(rateLimitKey, RATE_LIMIT_CONFIG)) {
      return ok({ sent: true });
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
      // Fail-open: a widget that never produced a token (blocked script,
      // load timeout) doesn't block a real login - a token that WAS
      // provided and failed verification still does.
      if (!shouldProceedWithoutBlocking(hasToken, verified)) {
        return ok({ sent: true });
      }
    }

    if (await shouldSendLoginOtp(db, email)) {
      try {
        const { auth } = await import('@/server/auth');
        await auth.api.sendVerificationOTP({
          body: { email, type: 'sign-in' },
          headers: getRequestHeaders()
        });
      } catch {
        // Swallow - a disposable-email rejection or send failure for a
        // real account must not produce a different response than the
        // not-found branch below, or it becomes a second enumeration
        // oracle.
      }
    }

    return ok({ sent: true });
  });
