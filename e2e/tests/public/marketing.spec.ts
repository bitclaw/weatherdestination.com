import { expect, test } from '@playwright/test';

test.describe('pricing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('renders h1', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('at least one plan card is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  });

  test('faq section is present', async ({ page }) => {
    await expect(page.locator('#faq')).toBeVisible();
  });
});

test.describe('features page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/features');
  });

  test('renders h1 or section heading', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('at least one feature card heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  });
});

test.describe('compare: vs ShipFast', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/compare/shipfast');
  });

  test('renders comparison heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/vs /i);
  });

  test('comparison table has rows', async ({ page }) => {
    await expect(page.locator('table tr').first()).toBeVisible();
  });

  test('CTA link is present', async ({ page }) => {
    const cta = page.getByRole('link', { name: /Get started/i }).last();
    await expect(cta).toBeVisible();
  });
});

test.describe('compare: vs Vercel Templates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/compare/vercel-templates');
  });

  test('renders comparison heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/vs /i);
  });

  test('comparison table has rows', async ({ page }) => {
    await expect(page.locator('table tr').first()).toBeVisible();
  });

  test('CTA link is present', async ({ page }) => {
    const cta = page.getByRole('link', { name: /Get started/i }).last();
    await expect(cta).toBeVisible();
  });
});
