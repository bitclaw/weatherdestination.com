import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe.configure({ mode: 'serial' });
test.describe('notifications bell', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  // notify() is only ever called from notes.mutations.ts createNoteFn in this
  // codebase (grepped src/features/**/server/*.ts) - creating a note is the
  // one real, already-wired action that produces a notification to test
  // against, rather than hitting notify() directly and bypassing the mutation.
  test('creating a note produces a bell notification, clicking it navigates there', async ({
    page
  }) => {
    const title = `e2e note ${Date.now()}`;

    await page.goto('/dashboard/notes/new', { waitUntil: 'networkidle' });
    await page.locator('#note-title').fill(title);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/dashboard\/notes$/);

    // NotificationBell's query isn't invalidated by note creation (no domain
    // event wired between the two features) - it was already mounted before
    // this note existed, so a reload is needed to force a fresh fetch.
    await page.reload({ waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'Notifications' }).click();
    const notificationRow = page.getByRole('button', {
      name: new RegExp(`Note "${title}" created`)
    });
    await expect(notificationRow).toBeVisible();

    await notificationRow.click();
    await expect(page).toHaveURL(/\/dashboard\/notes\/.+/);
  });
});
