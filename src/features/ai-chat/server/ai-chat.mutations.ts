import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireFeatureFlagEnabled } from '@/features/feature-flags/server/feature-flags.server';
import { ERROR_CODES } from '@/lib/constants';
import { db as sharedDb } from '@/lib/db';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { logUserEvent } from '@/lib/db/user-events';
import { checkUserRateLimit } from '@/lib/db/user-rate-limiter';
import { requireUser } from '@/server/require-user';
import {
  deleteConversation,
  insertConversation,
  insertMessage,
  updateConversationTitle
} from './ai-chat.server';

export const createConversationFn = createServerFn({ method: 'POST' })
  .validator(z.object({ title: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(sharedDb, 'ai_chat_enabled');
    if (!flag.ok) return flag;

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      if (
        checkUserRateLimit(db, 'conversation.created', {
          windowMs: 60_000,
          max: 20
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many conversations. Try again in a minute.'
        );
      const conversation = insertConversation(db, { title: data.title });
      logUserEvent(db, 'conversation.created', { id: conversation.id });
      return ok(conversation);
    });
  });

export const saveMessageFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      messageId: z.string().min(1).max(36),
      conversationId: z.string().min(1).max(36),
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(16_000)
    })
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(sharedDb, 'ai_chat_enabled');
    if (!flag.ok) return flag;

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      if (
        checkUserRateLimit(db, 'chat.message.saved', {
          windowMs: 60_000,
          max: 120
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many messages. Try again in a minute.'
        );
      const message = insertMessage(db, {
        id: data.messageId,
        conversationId: data.conversationId,
        role: data.role,
        content: data.content
      });
      if (!message)
        return err(ERROR_CODES.NOT_FOUND, 'Conversation not found.');
      logUserEvent(db, 'chat.message.saved', { role: data.role });
      return ok(message);
    });
  });

export const deleteConversationFn = createServerFn({ method: 'POST' })
  .validator(z.object({ conversationId: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(sharedDb, 'ai_chat_enabled');
    if (!flag.ok) return flag;

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      if (
        checkUserRateLimit(db, 'conversation.deleted', {
          windowMs: 60_000,
          max: 20
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many deletions. Try again in a minute.'
        );
      const result = deleteConversation(db, data.conversationId);
      if (!result.ok) return result;
      logUserEvent(db, 'conversation.deleted', {
        id: data.conversationId
      });
      return result;
    });
  });

export const updateConversationTitleFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      conversationId: z.string().min(1).max(36),
      title: z.string().min(1).max(100)
    })
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(sharedDb, 'ai_chat_enabled');
    if (!flag.ok) return flag;

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      if (
        checkUserRateLimit(db, 'conversation.title.updated', {
          windowMs: 60_000,
          max: 20
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many requests. Try again in a minute.'
        );
      const changes = updateConversationTitle(
        db,
        data.conversationId,
        data.title
      );
      if (changes === 0)
        return err(ERROR_CODES.NOT_FOUND, 'Conversation not found');
      logUserEvent(db, 'conversation.title.updated', {
        id: data.conversationId
      });
      return ok({ updated: true });
    });
  });
