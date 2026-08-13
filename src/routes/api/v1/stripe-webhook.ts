import { createFileRoute } from '@tanstack/react-router';
import { randomUUIDv7 } from 'bun';
import {
  handleStripeWebhook,
  WebhookConfigError
} from '@/features/billing/server/stripe.server';
import { createLogger } from '@/lib/logger';

export const Route = createFileRoute('/api/v1/stripe-webhook')({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        // weak-type-ok: server handler context has no exported requestId type from the framework
        const ctxBag = context as unknown as Record<string, unknown>;
        const requestId = ctxBag?.requestId?.toString() ?? randomUUIDv7();
        const log = createLogger({ requestId });

        const signature = request.headers.get('stripe-signature') ?? '';
        const body = await request.text();

        if (!body || !signature) {
          return Response.json(
            { error: 'Missing body or signature' },
            { status: 400 }
          );
        }

        try {
          await handleStripeWebhook(body, signature);
          return Response.json({ received: true });
        } catch (error: unknown) {
          // `err`, not `error` - pino only auto-serializes the reserved
          // `err` key (message/stack extraction). Logging under `error`
          // silently produces an empty {} for every failure.
          log.error({ err: error }, 'Stripe webhook processing failed');
          if (error instanceof WebhookConfigError) {
            return Response.json(
              { error: 'Server configuration error' },
              { status: 500 }
            );
          }
          // Never forward error.message to the caller - Stripe webhook
          // failures can carry DB error text (schema/column names) or
          // internal file paths. Detail stays in the log line above.
          return Response.json(
            { error: 'Webhook processing failed' },
            { status: 400 }
          );
        }
      }
    }
  }
});
