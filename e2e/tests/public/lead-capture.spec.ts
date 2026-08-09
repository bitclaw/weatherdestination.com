import { expect, test } from '@playwright/test';

// LeadForm itself is commented out by default in landing-hero.tsx (a swap-in
// for the default CTA, not something rendered alongside it - see
// docs/warpkit/features/lead-capture.md), so there's no live UI to drive here. Hit
// the real /api/v1/lead route directly instead: still real e2e (actual
// server, actual DB, actual rate limiter), just skipping the dormant-by-design
// component.
test.describe('lead capture endpoint', () => {
  test('accepts turnstileToken: null (Turnstile disabled, the default)', async ({
    request
  }) => {
    const email = `e2e-lead-${Date.now()}@example.com`;
    const res = await request.post('/api/v1/lead', {
      data: { email, turnstileToken: null }
    });

    // Regression check for the exact bug this session shipped: a schema
    // using .optional() instead of .nullish() rejects every request with
    // turnstileToken: null (NoCaptchaProvider's actual value) with a 400,
    // not just duplicates.
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('accepts a missing turnstileToken', async ({ request }) => {
    const email = `e2e-lead-${Date.now()}@example.com`;
    const res = await request.post('/api/v1/lead', { data: { email } });
    expect(res.status()).toBe(200);
  });

  test('resubmitting the same email is a no-op, not an error', async ({
    request
  }) => {
    const email = `e2e-lead-dup-${Date.now()}@example.com`;

    const first = await request.post('/api/v1/lead', {
      data: { email, turnstileToken: null }
    });
    expect(first.status()).toBe(200);

    const second = await request.post('/api/v1/lead', {
      data: { email, turnstileToken: null }
    });
    expect(second.status()).toBe(200);
    const body = await second.json();
    expect(body.ok).toBe(true);
  });

  test('rejects an invalid email', async ({ request }) => {
    const res = await request.post('/api/v1/lead', {
      data: { email: 'not-an-email', turnstileToken: null }
    });
    expect(res.status()).toBe(400);
  });
});
