import { randomUUIDv7 } from 'bun';
import type { db as sharedDb } from '@/lib/db';
import { adminAuditLog } from '@/lib/db/schema';

type Db = typeof sharedDb;

// Durable, unconditional record of an admin action - written from
// better-auth's own hooks.after (src/server/auth.ts) for impersonation
// specifically, so the trail can't be skipped by a client calling
// authClient.admin.impersonateUser directly without going through this
// app's own adminImpersonateUserFn pre-check first. Never throws: an audit
// write failing must never block the admin action it's recording, only be
// logged for someone to notice.
export async function recordAdminAuditEvent(
  db: Db,
  params: {
    type: string;
    adminUserId: string;
    targetUserId?: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      id: randomUUIDv7(),
      type: params.type,
      adminUserId: params.adminUserId,
      targetUserId: params.targetUserId ?? null,
      payload: params.payload ? JSON.stringify(params.payload) : null,
      createdAt: new Date()
    });
  } catch (error: unknown) {
    const { createLogger } = await import('@/lib/logger');
    createLogger({ module: 'admin-audit-log' }).error(
      { error, ...params },
      'failed to write admin audit event'
    );
  }
}
