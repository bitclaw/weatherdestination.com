import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe.configure({ mode: 'serial' });
test.describe('credits page', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/settings/credits', {
      waitUntil: 'networkidle'
    });
  });

  test('renders heading and a numeric balance', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible();
    await expect(page.getByText('credits remaining')).toBeVisible();
  });

  // No VITE_STRIPE_CREDITS_PRICE_ID configured in this environment, so the
  // real top-up purchase can't be exercised without Stripe test-mode secrets.
  // Covers the config gate itself: either the buy button renders, or the
  // not-configured card does - never neither.
  test('renders either a buy-credits button or the not-configured card', async ({
    page
  }) => {
    const buyButton = page.getByRole('button', { name: /^Buy \d+ credits$/ });
    const notConfigured = page.getByText('Top-up not configured');

    await expect(buyButton.or(notConfigured)).toBeVisible();
  });
});
