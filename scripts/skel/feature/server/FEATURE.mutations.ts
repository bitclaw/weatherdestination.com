import { err } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { entityInputSchema } from '@/features/FEATURE/FEATURE.constants';
import { ERROR_CODES } from '@/lib/constants';
import { getUserDb, withWriteLock } from '@/lib/db/user-db';
import { logUserEvent } from '@/lib/db/user-events';
import { checkUserRateLimit } from '@/lib/db/user-rate-limiter';
import { requireUser } from '@/server/require-user';
import { createEntity, deleteEntity, updateEntity } from './FEATURE.server';

export const createEntityMutation = createServerFn({ method: 'POST' })
  .inputValidator(entityInputSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      if (
        checkUserRateLimit(db, 'entity.created', { windowMs: 60_000, max: 20 })
      )
        return err(
          ERROR_CODES.RATE_LIMITED,
          'Too many entities created. Try again later.'
        );

      const result = createEntity(db, data);
      if (!result.ok) return result;
      logUserEvent(db, 'entity.created', { id: result.data.id });
      // To send an in-app notification, add import and uncomment:
      //   import { notify } from '@/lib/db/notify';
      //   notify(db, { title: 'Entity created', href: `/dashboard/FEATURE/${result.data.id}` });
      return result;
    });
  });

export const updateEntityMutation = createServerFn({ method: 'POST' })
  .inputValidator(entityInputSchema.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      const result = updateEntity(db, data);
      if (!result.ok) return result;
      logUserEvent(db, 'entity.updated', { id: result.data.id });
      return result;
    });
  });

export const deleteEntityMutation = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return withWriteLock(user.id, () => {
      const db = getUserDb(user.id);
      const result = deleteEntity(db, data.id);
      if (!result.ok) return result;
      logUserEvent(db, 'entity.deleted', { id: data.id });
      return result;
    });
  });
