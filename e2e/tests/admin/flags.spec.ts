import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe.configure({ mode: 'serial' });
test.describe('admin feature flags', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/admin/feature-flags', {
      waitUntil: 'networkidle'
    });
  });

  test('renders feature flags heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Feature Flags' })
    ).toBeVisible();
  });

  test('invalid flag name shows validation error', async ({ page }) => {
    await page
      .locator('input[placeholder="new_feature_name"]')
      .fill('1invalid');
    await page.getByRole('button', { name: 'Add Flag' }).click();
    await expect(
      page.getByText(
        'Flag name must start with a letter and contain only lowercase letters, numbers, and underscores.'
      )
    ).toBeVisible();
  });

  test('add flag, toggle on and off, then delete it', async ({ page }) => {
    const flagName = `test_flag_${Date.now()}`;

    // Add
    await page.locator('input[placeholder="new_feature_name"]').fill(flagName);
    await page.getByRole('button', { name: 'Add Flag' }).click();

    const flagCode = page.locator('code', { hasText: flagName });
    await expect(flagCode).toBeVisible();

    const flagRow = flagCode.locator(
      'xpath=ancestor::div[contains(@class, "justify-between")]'
    );

    // Toggle on
    const toggle = flagRow.getByRole('switch');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Toggle off
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Delete
    await flagRow.getByRole('button', { name: `Delete ${flagName}` }).click();
    await expect(flagCode).not.toBeVisible();
  });
});
