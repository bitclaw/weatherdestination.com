import { expect, test } from '@playwright/test';

test.describe('landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hero h1 renders', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('navbar links render', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: 'Features' }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Pricing' }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Blog' }).first()
    ).toBeVisible();
  });

  test('features section is present', async ({ page }) => {
    await expect(page.locator('#features')).toBeVisible();
  });

  test('pricing section is present', async ({ page }) => {
    await expect(page.locator('#pricing')).toBeVisible();
  });

  test('faq section is present', async ({ page }) => {
    await expect(page.locator('#faq')).toBeVisible();
  });

  test('footer legal links render', async ({ page }) => {
    const footer = page.getByRole('contentinfo');
    await expect(
      footer.getByRole('link', { name: 'Privacy Policy' })
    ).toBeVisible();
    await expect(
      footer.getByRole('link', { name: 'Terms of Service' })
    ).toBeVisible();
  });
});
