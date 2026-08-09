import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export const stripe = new Proxy({} as Stripe, {
  get: (_target, prop) => {
    if (!_stripe) {
      _stripe = new Stripe(
        process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder',
        {
          apiVersion: '2026-05-27.dahlia'
        }
      );
    }
    // weak-type-ok: Proxy get trap needs symbol-keyed indexing Stripe's own type doesn't support
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop];
  }
});
