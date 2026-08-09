import { createFileRoute } from '@tanstack/react-router';
import { randomUUIDv7 } from 'bun';
import { z } from 'zod';
import { config } from '@/config';
import { isEnabled } from '@/lib/feature-flags';
import { createLogger } from '@/lib/logger';
import { sendEmail } from '@/server/email';
import { LeadConfirmationEmail } from '@/server/email-templates';
import { createRateLimiter, getClientIP } from '@/server/rate-limit';

// Exported for src/routes/api/v1/lead.test.ts. turnstileToken must stay
// .nullish() (accepts null AND undefined), not .optional() (undefined only)
// - NoCaptchaProvider's token is `null`, not undefined, so with Turnstile
// disabled (the out-of-the-box default) an .optional() schema rejected
// every lead submission on a fresh clone.
export const leadSchema = z.object({
  email: z
    .string()
    .email()
    .min(1)
    .max(254)
    .transform(e => e.toLowerCase()),
  turnstileToken: z.string().nullish()
});
const schema = leadSchema;
const limiter = createRateLimiter({ windowMs: 60 * 1000, max: 20 });

export const Route = createFileRoute('/api/v1/lead')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const log = createLogger({ route: 'lead' });

        if (!isEnabled('leads')) {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }

        const ip = getClientIP({
          'cf-connecting-ip':
            request.headers.get('cf-connecting-ip') ?? undefined,
          'x-real-ip': request.headers.get('x-real-ip') ?? undefined,
          'x-forwarded-for': request.headers.get('x-forwarded-for') ?? undefined
        });

        if (limiter.check(ip ?? undefined)) {
          return Response.json({ error: 'Too many requests' }, { status: 429 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: 'Invalid email' }, { status: 400 });
        }

        if (process.env.TURNSTILE_SECRET_KEY) {
          const { verifyTurnstileToken } = await import(
            '@/features/captcha/verify-turnstile.server'
          );
          const valid = await verifyTurnstileToken(
            parsed.data.turnstileToken ?? '',
            ip ?? undefined
          );
          if (!valid) {
            return Response.json(
              { error: 'Captcha verification failed' },
              { status: 403 }
            );
          }
        }

        try {
          const { db } = await import('@/lib/db');
          const { leads } = await import('@/lib/db/schema');
          const leadId = randomUUIDv7();
          await db
            .insert(leads)
            .values({
              id: leadId,
              email: parsed.data.email,
              createdAt: new Date()
            })
            .onConflictDoNothing();

          const emailResult = await sendEmail({
            to: parsed.data.email,
            subject: `You're on the ${config.appName} list!`,
            react: LeadConfirmationEmail({ appName: config.appName })
          });
          if (!emailResult.ok) {
            // Lead is already saved; a failed confirmation email shouldn't
            // fail the request, but it must not be swallowed silently.
            // leadId, not email - PII in the application log stream widens
            // the GDPR/erasure surface; the email is already in the leads
            // table, correlate via leadId when actually needed.
            log.error(
              { leadId, error: emailResult },
              'Failed to send lead confirmation email'
            );
          }

          return Response.json({ ok: true });
        } catch (error: unknown) {
          log.error({ error }, 'Failed to save lead');
          return Response.json(
            { error: 'Failed to save lead' },
            { status: 500 }
          );
        }
      }
    }
  }
});
