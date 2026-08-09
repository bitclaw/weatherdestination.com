import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe.configure({ mode: 'serial' });
test.describe('api keys page', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/api-keys', { waitUntil: 'networkidle' });
  });

  test('renders heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
  });

  test('create, reveal once, then revoke a key', async ({ page }) => {
    const keyName = `e2e-key-${Date.now()}`;

    await page.getByRole('button', { name: 'New API key' }).click();
    await expect(
      page.getByRole('heading', { name: 'Create API Key' })
    ).toBeVisible();
    await page.locator('#key-name').fill(keyName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Raw key is shown exactly once - never stored or shown again.
    await expect(
      page.getByRole('heading', { name: 'Save your API key' })
    ).toBeVisible();
    const rawKey = await page.locator('p.select-all').textContent();
    expect(rawKey).toMatch(/^wk_[0-9a-f]{32}$/);
    await page.getByRole('button', { name: 'Done' }).click();

    const row = page.locator('tr', { hasText: keyName });
    await expect(row).toBeVisible();
    await expect(row.getByText('Active')).toBeVisible();

    await row.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Revoke' }).click();
    await expect(
      page.getByRole('heading', { name: 'Revoke API key' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Revoke', exact: true }).click();
    await expect(row.getByText('Revoked')).toBeVisible();
  });
});
