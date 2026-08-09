import { expect, test } from '@playwright/test';

test.describe('privacy policy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/privacy');
  });

  test('renders h1 and date', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Privacy Policy' })
    ).toBeVisible();
    await expect(
      page.getByText(/Last updated:|Effective date:/i)
    ).toBeVisible();
  });

  test('back to home link navigates to /', async ({ page }) => {
    await page.getByRole('link', { name: /Back to home/i }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('terms of service', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tos');
  });

  test('renders h1 and date', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Terms of Service' })
    ).toBeVisible();
    await expect(
      page.getByText(/Last updated:|Effective date:/i)
    ).toBeVisible();
  });

  test('back to home link navigates to /', async ({ page }) => {
    await page.getByRole('link', { name: /Back to home/i }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('changelog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/changelog');
  });

  test('renders heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Changelog' })
    ).toBeVisible();
  });

  test('at least one release version is visible', async ({ page }) => {
    await expect(page.getByText(/v\d+\.\d+/).first()).toBeVisible();
  });
});
