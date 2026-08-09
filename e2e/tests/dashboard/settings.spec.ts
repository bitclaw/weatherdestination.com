import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe.configure({ mode: 'serial' });
test.describe('settings pages', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test.describe('notifications', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/dashboard/settings/notifications', {
        waitUntil: 'networkidle'
      });
    });

    test('renders notifications heading and marketing toggle', async ({
      page
    }) => {
      await expect(
        page.getByRole('heading', { name: 'Notifications' })
      ).toBeVisible();
      await expect(page.getByText('Marketing emails')).toBeVisible();
      await expect(page.getByText('Security emails')).toBeVisible();
    });

    test('toggling marketing emails off persists across reload', async ({
      page
    }) => {
      const switches = page.getByRole('switch');
      const marketingSwitch = switches.first();
      const securitySwitch = switches.last();

      await expect(securitySwitch).toBeDisabled();

      const wasChecked =
        (await marketingSwitch.getAttribute('aria-checked')) === 'true';
      await marketingSwitch.click();
      await expect(marketingSwitch).toHaveAttribute(
        'aria-checked',
        String(!wasChecked)
      );

      await page.getByRole('button', { name: /update notifications/i }).click();
      await expect(
        page.getByText('Notification preferences updated').first()
      ).toBeVisible();

      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.getByRole('switch').first()).toHaveAttribute(
        'aria-checked',
        String(!wasChecked)
      );

      // Restore original state so other tests/runs aren't affected.
      await page.getByRole('switch').first().click();
      await page.getByRole('button', { name: /update notifications/i }).click();
      await expect(
        page.getByText('Notification preferences updated').first()
      ).toBeVisible();
    });
  });

  test.describe('display', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page);
      await page.goto('/dashboard/settings/display', {
        waitUntil: 'networkidle'
      });
    });

    test('renders display heading and real sidebar items, not scaffold ones', async ({
      page
    }) => {
      await expect(
        page.getByRole('heading', { name: 'Display' })
      ).toBeVisible();
      await expect(
        page.getByText('Notes', { exact: true }).first()
      ).toBeVisible();
      await expect(
        page.getByText('Billing', { exact: true }).first()
      ).toBeVisible();
      await expect(page.getByText('Recents')).toHaveCount(0);
      await expect(page.getByText('Applications')).toHaveCount(0);
    });

    test('hiding a sidebar item removes it from the live sidebar', async ({
      page
    }) => {
      const notesCheckbox = page.getByLabel('Notes', { exact: true });
      await expect(notesCheckbox).toBeChecked();

      await notesCheckbox.click();
      await page.getByRole('button', { name: /update display/i }).click();
      await expect(
        page.getByText('Display preferences updated').first()
      ).toBeVisible();

      await page.reload({ waitUntil: 'networkidle' });
      await expect(
        page
          .locator('[data-slot="sidebar"]')
          .getByText('Notes', { exact: true })
      ).not.toBeVisible();

      // Restore
      await page.getByLabel('Notes', { exact: true }).click();
      await page.getByRole('button', { name: /update display/i }).click();
      await expect(
        page.getByText('Display preferences updated').first()
      ).toBeVisible();
      await page.reload({ waitUntil: 'networkidle' });
      await expect(
        page
          .locator('[data-slot="sidebar"]')
          .getByText('Notes', { exact: true })
      ).toBeVisible();
    });
  });
});
