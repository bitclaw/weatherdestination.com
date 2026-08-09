import { err } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { config } from '@/config';
import { ERROR_CODES } from '@/lib/constants';
import { createRateLimiter, getClientIP } from '@/server/rate-limit';
import { validateEmailLogic } from './email-validation-logic';

// Pre-auth, unauthenticated endpoint - no per-user identity to key on, so
// IP-based like the other pre-auth public endpoint (lead.ts). The mxCheck
// path does a live DNS lookup with up to a 5s timeout per call, otherwise
// unbounded.
const limiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  failClosedOnUnknownIp: true
});

export const validateEmail = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    if (limiter.check(getClientIP() ?? undefined)) {
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again later.'
      );
    }

    const { isDisposableEmail, validateEmailDomain } = await import(
      '@bitclaw/disposable-email'
    );
    return validateEmailLogic(data.email, {
      disposableEmailCheck: config.auth.disposableEmailCheck,
      mxCheck: config.auth.mxCheck,
      isDisposableEmail,
      validateEmailDomain
    });
  });
