import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { config } from '@/config';
import { createLogger } from '@/lib/logger';
import { sendEmail } from '@/server/email';
import { ContactNotificationEmail } from '@/server/email-templates';
import { createRateLimiter, getClientIP } from '@/server/rate-limit';

// Exported for src/routes/api/v1/contact.test.ts. turnstileToken must stay
// .nullish() (accepts null AND undefined), not .optional() (undefined only)
// - NoCaptchaProvider's token is `null`, not undefined - see lead.ts's
// identical comment.
export const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z
    .string()
    .email()
    .min(1)
    .max(254)
    .transform(e => e.toLowerCase()),
  message: z.string().min(10).max(5000),
  turnstileToken: z.string().nullish()
});
const schema = contactSchema;
const limiter = createRateLimiter({ windowMs: 60 * 1000, max: 20 });

// Unlike lead.ts, this route has:
// - no feature flag: contact reachability is a baseline expectation for a
//   live site, not an opt-in like the pre-launch `leads` waitlist.
// - no DB write: no contact_messages table, no admin UI. This means a
//   failed sendEmail() has no persisted fallback, so (unlike lead.ts, where
//   a failed confirmation email is non-fatal because the lead row is
//   already saved) a failed send here must be a hard failure returned to
//   the client, not logged-and-swallowed.
export const Route = createFileRoute('/api/v1/contact')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const log = createLogger({ route: 'contact' });

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
          return Response.json({ error: 'Invalid request' }, { status: 400 });
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

        const emailResult = await sendEmail({
          to: config.legal.companyEmail,
          subject: `New contact form message from ${parsed.data.name}`,
          react: ContactNotificationEmail({
            appName: config.appName,
            name: parsed.data.name,
            email: parsed.data.email,
            message: parsed.data.message
          })
        });

        if (!emailResult.ok) {
          log.error(
            { error: emailResult },
            'Failed to send contact form email'
          );
          return Response.json(
            { error: 'Failed to send message' },
            { status: 500 }
          );
        }

        return Response.json({ ok: true });
      }
    }
  }
});
