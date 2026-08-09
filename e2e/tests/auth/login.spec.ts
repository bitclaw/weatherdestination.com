import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe.configure({ mode: 'serial' });
test.describe('authenticated session', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test('dashboard loads after login', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('session persists across page reload', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    expect(page.url()).toContain('/dashboard');
  });

  test('authenticated user at / redirects to dashboard', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/dashboard');
  });

  test('authenticated user at /login redirects to dashboard', async ({
    page
  }) => {
    await loginAsTestUser(page);
    await page.goto('/login', { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/dashboard');
  });
});
