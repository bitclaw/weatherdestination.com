import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { getUserDb } from '@/lib/db/user-db';
import { requireUser } from '@/server/require-user';
import { getEntityById, listEntities } from './FEATURE.server';

export const getEntities = createServerFn().handler(async () => {
  const user = await requireUser();
  if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

  return ok(listEntities(getUserDb(user.id)));
});

export const getEntityDetail = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    const entity = getEntityById(getUserDb(user.id), data.id);
    if (!entity) return err(ERROR_CODES.NOT_FOUND, 'Entity not found.');

    return ok(entity);
  });
