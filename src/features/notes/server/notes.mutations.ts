import { err } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireFeatureFlagEnabled } from '@/features/feature-flags/server/feature-flags.server';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { notify } from '@/lib/db/notify';
import { subscriptions } from '@/lib/db/schema';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { logUserEvent } from '@/lib/db/user-events';
import { checkUserRateLimit } from '@/lib/db/user-rate-limiter';
import type { PlanKey } from '@/lib/entitlements';
import { checkEntitlement } from '@/lib/entitlements';
import { requireUser } from '@/server/require-user';
import { noteInputSchema, noteUpdateSchema } from '../notes.constants';
import {
  createNote,
  deleteNote,
  listNotes,
  togglePin,
  updateNote
} from './notes.server';

export const createNoteFn = createServerFn({ method: 'POST' })
  .validator(noteInputSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'notes_enabled');
    if (!flag.ok) return flag;

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
      columns: { plan: true }
    });
    const plan = (sub?.plan ?? 'free') as PlanKey;

    return withWriteLock(user.id, () => {
      const userDb = getUserDb(user.id);

      if (
        checkUserRateLimit(userDb, 'note.created', {
          windowMs: 60_000,
          max: 20
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many notes created. Try again later.'
        );

      const count = listNotes(userDb).length;
      const { allowed, used, limit } = checkEntitlement(
        plan,
        'maxNotes',
        count
      );
      if (!allowed)
        return err(
          ERROR_CODES.PLAN_LIMIT_EXCEEDED,
          `Note limit reached: ${used}/${limit} on the ${plan} plan. Upgrade to create more.`
        );

      const result = createNote(userDb, data);
      if (!result.ok) return result;
      logUserEvent(userDb, 'note.created', { id: result.data.id });
      notify(userDb, {
        title: `Note "${result.data.title}" created`,
        href: `/dashboard/notes/${result.data.id}`
      });
      return result;
    });
  });

export const updateNoteFn = createServerFn({ method: 'POST' })
  .validator(noteUpdateSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'notes_enabled');
    if (!flag.ok) return flag;

    return withWriteLock(user.id, () => {
      const userDb = getUserDb(user.id);
      if (
        checkUserRateLimit(userDb, 'note.updated', {
          windowMs: 60_000,
          max: 30
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many updates. Try again later.'
        );
      const result = updateNote(userDb, data);
      if (!result.ok) return result;
      logUserEvent(userDb, 'note.updated', { id: result.data.id });
      return result;
    });
  });

export const deleteNoteFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'notes_enabled');
    if (!flag.ok) return flag;

    return withWriteLock(user.id, () => {
      const userDb = getUserDb(user.id);
      if (
        checkUserRateLimit(userDb, 'note.deleted', {
          windowMs: 60_000,
          max: 20
        })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many deletes. Try again later.'
        );
      const result = deleteNote(userDb, data.id);
      if (!result.ok) return result;
      logUserEvent(userDb, 'note.deleted', { id: data.id });
      return result;
    });
  });

export const togglePinFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'notes_enabled');
    if (!flag.ok) return flag;

    return withWriteLock(user.id, () => {
      const userDb = getUserDb(user.id);
      if (
        checkUserRateLimit(userDb, 'note.pinned', { windowMs: 60_000, max: 30 })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many requests. Try again later.'
        );
      const result = togglePin(userDb, data.id);
      if (!result.ok) return result;
      logUserEvent(userDb, 'note.pinned', {
        id: data.id,
        pinned: result.data.pinned
      });
      return result;
    });
  });
