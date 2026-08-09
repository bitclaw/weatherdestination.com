// Shared mock builders for stripe-*.test.ts — not a test suite itself.
// Minimal Stripe object constructors: only include fields the handlers
// actually access, cast to satisfy TypeScript without full shape.
import type Stripe from 'stripe';

export const makeSession = (
  override: Partial<{
    userId: string;
    customerId: string;
    subscriptionId: string;
  }> = {}
) =>
  ({
    metadata: { userId: override.userId ?? '' },
    customer: override.customerId ?? 'cus_test',
    subscription: override.subscriptionId ?? 'sub_test',
    line_items: null,
    amount_total: 999,
    currency: 'usd'
  }) as unknown as Stripe.Checkout.Session;

export const makeStripeSub = (
  customerId: string,
  status: string,
  extra?: Record<string, unknown>
) =>
  ({
    id: 'sub_test',
    customer: customerId,
    status,
    ...extra
  }) as unknown as Stripe.Subscription;

export const makeInvoice = (customerId: string, subscriptionId?: string) =>
  ({
    customer: customerId,
    parent: {
      subscription_details: { subscription: subscriptionId ?? 'sub_test' }
    }
  }) as unknown as Stripe.Invoice;

export const makeCharge = (
  override: Partial<{
    paymentIntentId: string;
    customerId: string;
    refunded: boolean;
    amountRefunded: number;
  }> = {}
) =>
  ({
    payment_intent: override.paymentIntentId ?? 'pi_test',
    customer: override.customerId ?? 'cus_test',
    refunded: override.refunded ?? true,
    amount_refunded: override.amountRefunded ?? 500
  }) as unknown as Stripe.Charge;

export const makeDispute = (
  override: Partial<{
    paymentIntentId: string;
    chargeId: string;
    amount: number;
  }> = {}
) =>
  ({
    payment_intent: override.paymentIntentId ?? null,
    charge: override.chargeId ?? 'ch_test',
    amount: override.amount ?? 500
  }) as unknown as Stripe.Dispute;
