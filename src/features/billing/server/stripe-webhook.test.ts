import { afterEach, describe, expect, it } from 'bun:test';
import { handleStripeWebhook, WebhookConfigError } from './stripe.server';

// Tests for the webhook handler's signature validation.
// MSW is not needed here: Stripe's constructEvent() validates signatures
// synchronously without making HTTP calls.
//
// .env.test sets a fake STRIPE_WEBHOOK_SECRET so the signature-validation
// tests below can reach real Stripe signature checking. The missing-secret
// test unsets it for itself and restores it afterward.

describe('handleStripeWebhook signature validation', () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it('throws WebhookConfigError on missing webhook secret, distinct from a bad signature', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await expect(
      handleStripeWebhook('{}', 'invalid-signature')
    ).rejects.toThrow(WebhookConfigError);
  });

  it('throws on malformed signature header', async () => {
    await expect(
      handleStripeWebhook(
        JSON.stringify({ type: 'checkout.session.completed' }),
        'not-a-real-stripe-signature'
      )
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('throws when body is tampered', async () => {
    // A correctly formatted Stripe signature for a different body fails
    const fakeSignature =
      't=1234567890,v1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    await expect(
      handleStripeWebhook('{"type":"tampered"}', fakeSignature)
    ).rejects.toThrow('Invalid webhook signature');
  });
});
