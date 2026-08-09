import { HttpResponse, http, passthrough } from 'msw';

export const stripeHandlers = [
  http.get('https://api.stripe.com/v1/subscriptions/:id', ({ params }) =>
    HttpResponse.json({
      id: params.id,
      object: 'subscription',
      status: 'active',
      customer: 'cus_test',
      // current_period_end lives on the subscription item, not the
      // top-level object, in the API version this app targets.
      items: {
        data: [
          {
            price: { id: 'price_test' },
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400
          }
        ]
      }
    })
  ),
  http.get('https://api.stripe.com/v1/customers/:id', () =>
    HttpResponse.json({
      id: 'cus_test',
      email: 'test@example.com',
      object: 'customer'
    })
  ),
  http.delete('https://api.stripe.com/v1/customers/:id', ({ params }) =>
    HttpResponse.json({ id: params.id, object: 'customer', deleted: true })
  ),
  http.post('https://api.stripe.com/v1/checkout/sessions', () =>
    HttpResponse.json({
      id: 'cs_test',
      url: 'https://checkout.stripe.com/test',
      object: 'checkout.session'
    })
  ),
  http.get('https://api.stripe.com/v1/subscriptions', () =>
    HttpResponse.json({ data: [], object: 'list', has_more: false })
  ),
  http.delete('https://api.stripe.com/v1/subscriptions/:id', ({ params }) =>
    HttpResponse.json({
      id: params.id,
      object: 'subscription',
      status: 'canceled'
    })
  ),
  http.post('https://api.stripe.com/v1/billing_portal/sessions', () =>
    HttpResponse.json({
      id: 'bps_test',
      url: 'https://billing.stripe.com/test',
      object: 'billing_portal.session'
    })
  ),
  http.get('https://api.stripe.com/v1/charges/:id', ({ params }) =>
    HttpResponse.json({
      id: params.id,
      object: 'charge',
      customer: 'cus_test'
    })
  )
];

export const resendHandlers = [
  http.post('https://api.resend.com/emails', () =>
    HttpResponse.json({ id: 'email_default' })
  )
];

export const turnstileHandlers = [
  http.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', () =>
    HttpResponse.json({ success: true })
  )
];

// Pass through requests to localhost so Bun.serve() test servers work
// without triggering "unhandled request" warnings.
export const localHandlers = [
  http.all('http://127.0.0.1/*', () => passthrough()),
  http.all('http://localhost/*', () => passthrough())
];

export const handlers = [
  ...stripeHandlers,
  ...resendHandlers,
  ...turnstileHandlers,
  ...localHandlers
];
