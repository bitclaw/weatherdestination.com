import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireFeatureFlagEnabled } from '@/features/feature-flags/server/feature-flags.server';
import { ERROR_CODES } from '@/lib/constants';
import { db as sharedDb } from '@/lib/db';
import { getUserDb } from '@/lib/db/user-db';
import { createRateLimiter } from '@/server/rate-limit';
import { requireUser } from '@/server/require-user';
import { getMessages, listConversations } from './ai-chat.server';

const queryLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

export const listConversationsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(sharedDb, 'ai_chat_enabled');
    if (!flag.ok) return flag;
    if (queryLimiter.check(user.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );

    return ok(listConversations(getUserDb(user.id)));
  }
);

export const getConversationMessagesFn = createServerFn({ method: 'GET' })
  .validator(z.object({ conversationId: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(sharedDb, 'ai_chat_enabled');
    if (!flag.ok) return flag;
    if (queryLimiter.check(user.id))
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again in a minute.'
      );

    return ok(getMessages(getUserDb(user.id), data.conversationId));
  });
