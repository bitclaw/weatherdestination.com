/**
 * Stateful entity mutations , pair with FEATURE-stateful.server.ts.
 * Each transition fn gets its own mutation so callers can fire them independently.
 * Replace FEATURE/Entity/entity throughout.
 *
 * Rename to FEATURE.mutations.ts and delete the plain FEATURE.mutations.ts.
 */
import { err } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { logUserEvent } from '@/lib/db/user-events';
import { requireUser } from '@/server/require-user';
import {
  cancelEntity,
  completeEntity,
  createEntity,
  failEntity,
  startEntity
} from './FEATURE.server';

const idSchema = z.object({ id: z.string().min(1) });

export const createEntityMutation = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      // add domain fields here
    })
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      const result = createEntity(db, data);
      if (!result.ok) return result;
      logUserEvent(db, 'entity.created', { id: result.data.id });
      return result;
    });
  });

export const startEntityMutation = createServerFn({ method: 'POST' })
  .inputValidator(idSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      const result = startEntity(db, data.id);
      if (!result.ok) return result;
      logUserEvent(db, 'entity.started', { id: data.id });
      return result;
    });
  });

export const completeEntityMutation = createServerFn({ method: 'POST' })
  .inputValidator(idSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      const result = completeEntity(db, data.id);
      if (!result.ok) return result;
      logUserEvent(db, 'entity.completed', { id: data.id });
      return result;
    });
  });

export const failEntityMutation = createServerFn({ method: 'POST' })
  .inputValidator(idSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      const result = failEntity(db, data.id);
      if (!result.ok) return result;
      logUserEvent(db, 'entity.failed', { id: data.id });
      return result;
    });
  });

export const cancelEntityMutation = createServerFn({ method: 'POST' })
  .inputValidator(idSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      const result = cancelEntity(db, data.id);
      if (!result.ok) return result;
      logUserEvent(db, 'entity.cancelled', { id: data.id });
      return result;
    });
  });
