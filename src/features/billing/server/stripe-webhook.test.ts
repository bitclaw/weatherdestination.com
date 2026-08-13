import { afterEach, describe, expect, it } from 'bun:test';
import { createHmac } from 'node:crypto';
import { handleStripeWebhook, WebhookConfigError } from './stripe.server';

// Tests for the webhook handler's signature validation.
// MSW is not needed here: Stripe's constructEventAsync() validates
// signatures without making HTTP calls.
//
// .env.test sets a fake STRIPE_WEBHOOK_SECRET so the signature-validation
// tests below can reach real Stripe signature checking. The missing-secret
// test unsets it for itself and restores it afterward.
//
// The success-path signature below is built with node:crypto's createHmac
// directly, not Stripe SDK's own generateTestHeaderString - that helper is
// sync-only and throws CryptoProviderOnlySupportsAsyncError under Bun (Bun
// resolves to Stripe's SubtleCryptoProvider, async-only, not
// NodeCryptoProvider). That same sync/async mismatch is exactly the bug
// class this file's missing success-path coverage let ship to a sibling
// deploy of this code: every webhook was rejected regardless of a correct
// signature, because the sync constructEvent() unconditionally threw
// before ever comparing bytes. Every test below only asserted a throw,
// which the crypto-provider bug also produced (for the wrong reason) - so
// none of them caught it.
function signPayload(secret: string, payload: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

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

  it('accepts a validly signed event and does not throw', async () => {
    const payload = JSON.stringify({
      id: 'evt_test_valid',
      type: 'invoice.payment_succeeded'
    });
    const signature = signPayload(originalWebhookSecret!, payload);
    await expect(
      handleStripeWebhook(payload, signature)
    ).resolves.toBeUndefined();
  });
});
