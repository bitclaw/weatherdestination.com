import type Stripe from 'stripe';
import { config } from '@/config';
import { db as sharedDb } from '@/lib/db';
import { handleCheckoutCompleted } from './stripe-checkout.server';
import {
  handleChargeDisputeCreated,
  handleChargeRefunded
} from './stripe-refund.server';
import { type BillingMode, type Db, stripe } from './stripe-shared.server';
import {
  handleInvoicePaid,
  handlePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdate
} from './stripe-subscription.server';

// Distinct from a signature-validation failure: this means the server itself
// isn't configured, not that the request is suspect. The webhook route
// returns 500 for this (retryable, alerts ops) instead of 400 (which reads
// the same as a genuine bad signature and gets swallowed the same way).
export class WebhookConfigError extends Error {}

export const handleStripeWebhook = async (
  body: string,
  signature: string
): Promise<void> => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new WebhookConfigError('STRIPE_WEBHOOK_SECRET is not configured');
  }

  let event: Stripe.Event;
  try {
    // constructEvent (sync) resolves to Stripe SDK's SubtleCryptoProvider
    // under Bun (not NodeCryptoProvider - Bun isn't detected as Node), which
    // only supports async HMAC computation. The sync call throws
    // CryptoProviderOnlySupportsAsyncError unconditionally, regardless of
    // whether the secret/signature are actually correct - this shipped a 9
    // day production outage on a sibling deploy of this exact code before
    // being caught. constructEventAsync is Stripe's own documented fix for
    // edge/non-Node runtimes.
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch {
    throw new Error('Invalid webhook signature');
  }

  await routeStripeEvent(event, sharedDb);
};

// Split from handleStripeWebhook so event-type routing is testable without
// needing a real Stripe-signed body , constructEvent() requires a real
// webhook secret, which test envs deliberately don't configure (see
// stripe-webhook.test.ts).
export const routeStripeEvent = async (
  event: Stripe.Event,
  db: Db,
  mode: BillingMode = config.billing.mode
): Promise<void> => {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session, db, mode);
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      if (mode !== 'subscription') break;
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdate(sub, db);
      break;
    }
    case 'customer.subscription.deleted': {
      if (mode !== 'subscription') break;
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(sub, db);
      break;
    }
    case 'invoice.payment_failed': {
      if (mode !== 'subscription') break;
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice, db);
      break;
    }
    case 'invoice.paid': {
      if (mode !== 'subscription') break;
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice, db);
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefunded(charge, db);
      break;
    }
    case 'charge.dispute.created': {
      const dispute = event.data.object as Stripe.Dispute;
      await handleChargeDisputeCreated(dispute, db);
      break;
    }
  }
};
