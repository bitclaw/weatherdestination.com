import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe.configure({ mode: 'serial' });
test.describe('admin access control', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test('unauthenticated /dashboard/admin redirects to login', async ({
    page
  }) => {
    await page.goto('/dashboard/admin');
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });

  test('admin can access user list page', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/admin', { waitUntil: 'networkidle' });
    await expect(
      page.getByRole('heading', { name: 'User List' })
    ).toBeVisible();
  });

  test('admin can access feature flags page', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/admin/feature-flags', {
      waitUntil: 'networkidle'
    });
    await expect(
      page.getByRole('heading', { name: 'Feature Flags' })
    ).toBeVisible();
  });
});
