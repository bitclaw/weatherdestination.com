import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { requireUser } from '@/server/require-user';
import { listFeatureRequests } from './feature-requests.server';

export const getFeatureRequestsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    return ok(await listFeatureRequests(db, user.id));
  }
);
