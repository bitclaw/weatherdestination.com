import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe.configure({ mode: 'serial' });
test.describe('feature requests page', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/feature-requests', {
      waitUntil: 'networkidle'
    });
  });

  test('renders heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Feature Requests' })
    ).toBeVisible();
  });

  test('create and delete a request', async ({ page }) => {
    const title = `e2e feature request ${Date.now()}`;

    await page.getByRole('button', { name: 'New request' }).click();
    await expect(
      page.getByRole('heading', { name: 'Create Feature Request' })
    ).toBeVisible();
    await page.locator('#fr-title').fill(title);
    await page.getByRole('button', { name: 'Save changes' }).click();

    const row = page.locator('tr', { hasText: title });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(
      page.getByRole('heading', { name: 'Delete feature request' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(row).not.toBeVisible();
  });
});
