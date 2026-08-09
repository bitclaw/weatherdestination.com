import { eq } from 'drizzle-orm';
import { config } from '@/config';
import { enqueue } from '@/features/jobs/enqueue.server';
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { createLogger } from '@/lib/logger';
import { resolveReceiptPlanName } from '@/server/event-handler-utils';
import { on } from '@/server/events';

const log = createLogger({ module: 'event-handlers' });

// Enqueued rather than sent inline: this handler runs inside the Stripe
// webhook's `await emit()` call, in the request path. A slow/hung email
// provider call here would stall the webhook response and risk a spurious
// Stripe retry; the job queue absorbs that latency instead.
on(
  'subscription.activated',
  async ({ email, name, amount, currency, planId }) => {
    const planName = resolveReceiptPlanName(config.stripe.plans, planId);
    enqueue('email:receipt', {
      email,
      name: name ?? null,
      planName,
      amount,
      currency
    });
  }
);

on('subscription.activated', async ({ userId, email, name }) => {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    columns: { trialEndsAt: true }
  });
  if (!sub?.trialEndsAt) return;

  const runAt = new Date(sub.trialEndsAt.getTime() - 3 * 24 * 60 * 60 * 1000);
  if (runAt <= new Date()) return;

  enqueue(
    'email:trial-expiring',
    { userId, email, name: name ?? null, daysLeft: 3 },
    // uniqueKey: a replayed subscription.activated event must not schedule a
    // second trial-expiring email for the same user.
    { runAt, uniqueKey: `trial-expiring:${userId}` }
  );
});

on('purchase.completed', async ({ email, name, amount, currency }) => {
  const planName = resolveReceiptPlanName(config.stripe.plans, undefined);
  enqueue('email:receipt', {
    email,
    name: name ?? null,
    planName,
    amount,
    currency
  });
});

// Template hookpoint: replace log.info with your own logic (e.g. enqueue a goodbye email).
on('account.deleted', async ({ userId }) => {
  log.info({ userId }, 'domain event: account.deleted (no handler yet)');
});

// Template hookpoint: replace log.info with your own logic (e.g. enqueue a credit receipt email).
on('credits.purchased', async ({ userId, amount }) => {
  log.info(
    { userId, amount },
    'domain event: credits.purchased (no handler yet)'
  );
});

// Template hookpoint: replace log.info with your own logic (e.g. a refund confirmation email).
on('billing.refunded', async ({ userId, kind, amount }) => {
  log.info(
    { userId, kind, amount },
    'domain event: billing.refunded (no handler yet)'
  );
});

// Flagged at error level, not info: a dispute needs a human to look at it -
// this is the ops-visible signal, not a UI feature. Replace/extend if you
// want a dedicated admin-side dispute queue.
on('billing.disputed', async ({ userId, amount }) => {
  log.error(
    { userId, amount },
    'domain event: billing.disputed (needs review)'
  );
});

// Flagged at error level: this is the durable trace that a promotion
// happened, since require-admin.ts's own write is a side effect of a read
// path and easy to miss in review. Replace/extend for a dedicated audit log.
// userId only, not email - PII in the application log stream widens the
// GDPR/erasure surface and leaks into log aggregators that have a different
// retention policy than the primary DB. Correlate to email via the DB when
// actually needed.
on('admin.auto-promoted', async ({ userId }) => {
  log.error({ userId }, 'domain event: admin.auto-promoted');
});

// This emit is a best-effort early signal only, NOT the audit trail - the
// actual durable, non-bypassable record is a better-auth hooks.after
// matcher on /admin/impersonate-user (src/server/auth.ts), which writes to
// admin_audit_log unconditionally whenever that endpoint actually creates
// an impersonation session, regardless of whether this event fired first.
on('admin.impersonation.started', async ({ adminUserId, targetUserId }) => {
  log.error(
    { adminUserId, targetUserId },
    'domain event: admin.impersonation.started'
  );
});
