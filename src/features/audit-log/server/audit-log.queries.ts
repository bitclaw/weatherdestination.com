import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { requireFeatureFlagEnabled } from '@/features/feature-flags/server/feature-flags.server';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { getUserDb } from '@/lib/db/user-db';
import { requireUser } from '@/server/require-user';
import { listAuditEvents } from './audit-log.server';

export const getAuditLogFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const flag = await requireFeatureFlagEnabled(db, 'audit_log_enabled');
    if (!flag.ok) return flag;

    return ok(listAuditEvents(getUserDb(user.id)));
  }
);
