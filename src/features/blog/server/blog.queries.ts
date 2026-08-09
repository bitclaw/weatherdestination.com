import { err } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { createRateLimiter } from '@/server/rate-limit';
import { getPostBySlug } from './blog.server';

// Public, unauthenticated GET running the full markdown render pipeline per
// request - same IP-keyed pattern as feature-flags' getFeatureFlagFn.
const limiter = createRateLimiter({ windowMs: 60_000, max: 120 });

export const getPostFn = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    if (limiter.check())
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again later.'
      );
    return getPostBySlug(data.slug);
  });
