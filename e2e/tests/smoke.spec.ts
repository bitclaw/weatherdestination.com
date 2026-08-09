import { expect, test } from '@playwright/test';

test('landing page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator('body')).toBeVisible();
});

test('unauthenticated /dashboard redirects to login', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL('**/login');
  expect(page.url()).toContain('/login');
});

test('login page renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
});
