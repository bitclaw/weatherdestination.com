import { expect, test } from '@playwright/test';

test.describe('blog index', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'networkidle' });
  });

  test('renders heading and post list', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Blog' })
    ).toBeVisible();
    const postLinks = page.getByRole('link', {
      name: /Getting Started|Per-User SQLite/
    });
    await expect(postLinks.first()).toBeVisible();
  });

  test('clicking a post navigates to it', async ({ page }) => {
    await page
      .getByRole('link', { name: 'Getting Started with Your SaaS Template' })
      .click();
    await expect(page).toHaveURL(/\/blog\/getting-started/);
  });

  test('clicking the second post navigates to it', async ({ page }) => {
    await page.getByRole('link', { name: /Why Per-User SQLite/ }).click();
    await expect(page).toHaveURL(/\/blog\/why-sqlite-per-user/);
  });
});

test.describe('blog post: getting-started', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog/getting-started', { waitUntil: 'networkidle' });
  });

  test('renders post title', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Getting Started with Your SaaS Template'
    );
  });

  test('back to blog link navigates to /blog', async ({ page }) => {
    await page.getByRole('link', { name: /Back to blog/ }).click();
    await expect(page).toHaveURL(/\/blog$/);
  });
});

test.describe('blog post: why-sqlite-per-user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog/why-sqlite-per-user', { waitUntil: 'networkidle' });
  });

  test('renders post title', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Why Per-User SQLite Is the Right Architecture for B2C SaaS'
    );
  });

  test('back to blog link navigates to /blog', async ({ page }) => {
    await page.getByRole('link', { name: /Back to blog/ }).click();
    await expect(page).toHaveURL(/\/blog$/);
  });
});

test('non-existent blog post shows not found', async ({ page }) => {
  await page.goto('/blog/does-not-exist');
  await expect(page.getByText('Post not found')).toBeVisible();
});
