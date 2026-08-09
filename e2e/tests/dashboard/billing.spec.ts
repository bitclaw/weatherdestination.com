import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

// Shallow smoke test only, no real Stripe checkout: this repo has no Stripe
// test-mode secrets wired into .env.e2e/CI, and driving Stripe's hosted
// Checkout page (cross-origin, card entry) is a separate concern from
// "does the billing page render correctly". The webhook race conditions
// that matter here are already covered at the right altitude by
// Promise.all-based integration tests against the handler directly
// (stripe-refund.test.ts, credits-crud.test.ts), not Playwright.
test.describe.configure({ mode: 'serial' });
test.describe('billing page', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/billing', { waitUntil: 'networkidle' });
  });

  test('renders without error', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
  });

  test('shows an upgrade option for a free-plan user', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Upgrade' }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Upgrade' }).first()
    ).toBeEnabled();
  });
});
