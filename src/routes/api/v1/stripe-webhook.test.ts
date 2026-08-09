import { afterEach, describe, expect, it } from 'bun:test';
import { Route } from './stripe-webhook';

// Route-level branches only - src/features/billing/server/stripe-webhook.test.ts
// covers handleStripeWebhook()'s own signature-validation logic directly.
// This file confirms the route wraps that correctly: missing body/signature
// short-circuits before calling it, WebhookConfigError maps to 500, and any
// other thrown error maps to 400 with a generic message (never the real
// error.message - see the comment in stripe-webhook.ts, fixed in c2cf7b8).

// TanStack Router's `handlers` type is a union of an object literal and a
// factory function, so TS can't narrow `.POST` statically even though the
// runtime shape is always the object literal here (same cast as
// src/routes/api/v1/ai-chat.test.ts).
const callPost = (request: Request) =>
  (
    Route.options.server as unknown as {
      handlers: { POST: (opts: { request: Request }) => Promise<Response> };
    }
  ).handlers.POST({ request });

const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

afterEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
});

const postRequest = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/v1/stripe-webhook', {
    method: 'POST',
    body,
    headers
  });

describe('POST /api/v1/stripe-webhook', () => {
  it('returns 400 when the body is empty', async () => {
    const response = await callPost(
      postRequest('', { 'stripe-signature': 'sig' })
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('Missing body or signature');
  });

  it('returns 400 when the stripe-signature header is missing', async () => {
    const response = await callPost(postRequest('{}'));

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('Missing body or signature');
  });

  it('returns 500 with a generic message when STRIPE_WEBHOOK_SECRET is unset', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const response = await callPost(
      postRequest('{}', { 'stripe-signature': 'sig' })
    );

    expect(response.status).toBe(500);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('Server configuration error');
  });

  it('returns 400 with a generic message for a bad signature, never the real error text', async () => {
    const response = await callPost(
      postRequest('{"type":"tampered"}', {
        'stripe-signature': 'not-a-real-stripe-signature'
      })
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('Webhook processing failed');
    expect(json.error).not.toContain('signature');
  });
});
