import { expect, test } from '@playwright/test';
import { TEST_USER } from '../../fixtures/users';
import { loginAsTestUser } from '../../helpers/auth';

test.describe.configure({ mode: 'serial' });
test.describe('admin user management', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/admin', { waitUntil: 'networkidle' });
  });

  test('renders user list heading and table', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'User List' })
    ).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('add user dialog opens with correct heading', async ({ page }) => {
    await page.getByRole('button', { name: 'Add User' }).click();
    await expect(page.getByRole('heading', { name: 'Add User' })).toBeVisible();
  });

  test('creates user and shows them in table', async ({ page }) => {
    const testEmail = `test-${Date.now()}@example.com`;

    await page.getByRole('button', { name: 'Add User' }).click();
    await page.locator('#add-name').fill('Test E2E User');
    await page.locator('#add-email').fill(testEmail);
    await page.getByRole('button', { name: 'Create User' }).click();

    const row = page.locator('tr', { hasText: testEmail });
    await expect(row).toBeVisible();
    await expect(row.getByText('invited')).toBeVisible();
  });

  test('row actions dropdown shows view details, ban and delete', async ({
    page
  }) => {
    const testEmail = `test-${Date.now()}@example.com`;

    await page.getByRole('button', { name: 'Add User' }).click();
    await page.locator('#add-name').fill('Test E2E User');
    await page.locator('#add-email').fill(testEmail);
    await page.getByRole('button', { name: 'Create User' }).click();

    const row = page.locator('tr', { hasText: testEmail });
    await row.getByRole('button', { name: 'Open menu' }).click();
    await expect(
      page.getByRole('menuitem', { name: 'View details' })
    ).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Ban' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  });

  test('ban and unban a user', async ({ page }) => {
    const testEmail = `test-${Date.now()}@example.com`;

    await page.getByRole('button', { name: 'Add User' }).click();
    await page.locator('#add-name').fill('Test E2E User');
    await page.locator('#add-email').fill(testEmail);
    await page.getByRole('button', { name: 'Create User' }).click();

    const row = page.locator('tr', { hasText: testEmail });
    await expect(row).toBeVisible();

    // Ban
    await row.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Ban' }).click();
    await expect(page.getByRole('heading', { name: /Ban/ })).toBeVisible();
    await page.locator('#ban-reason').fill('e2e test ban');
    await page.getByRole('button', { name: 'Ban User' }).click();
    await expect(row.getByText('banned')).toBeVisible();

    // Unban
    await row.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Unban' }).click();
    await expect(page.getByRole('heading', { name: /Unban/ })).toBeVisible();
    await page.getByRole('button', { name: 'Unban User' }).click();
    await expect(row.getByText('invited')).toBeVisible();
  });

  test('toggle access switch changes state', async ({ page }) => {
    const testEmail = `test-${Date.now()}@example.com`;

    await page.getByRole('button', { name: 'Add User' }).click();
    await page.locator('#add-name').fill('Test E2E User');
    await page.locator('#add-email').fill(testEmail);
    await page.getByRole('button', { name: 'Create User' }).click();

    const row = page.locator('tr', { hasText: testEmail });
    await expect(row).toBeVisible();

    const accessSwitch = row.getByRole('switch');
    const initialChecked = await accessSwitch.isChecked();
    await accessSwitch.click();
    await expect(accessSwitch).toHaveAttribute(
      'aria-checked',
      initialChecked ? 'false' : 'true'
    );
  });

  test('deleting another user actually removes them from the table', async ({
    page
  }) => {
    const testEmail = `test-${Date.now()}@example.com`;

    await page.getByRole('button', { name: 'Add User' }).click();
    await page.locator('#add-name').fill('Test E2E User');
    await page.locator('#add-email').fill(testEmail);
    await page.getByRole('button', { name: 'Create User' }).click();

    const row = page.locator('tr', { hasText: testEmail });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(
      page.getByRole('heading', { name: 'Delete user' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(row).not.toBeVisible();
  });

  // Regression coverage for the worst bug this session's audit found: an
  // admin could ban or delete their own account with no recovery path if
  // they were the last admin (requireAdmin() rejects the now-banned/deleted
  // session on every subsequent request). Fixed via isSelfTarget() in
  // admin.server.ts; these tests click through the real UI against the
  // logged-in admin's own row, not just unit-test the guard function.
  test('cannot ban own admin account', async ({ page }) => {
    const ownRow = page.locator('tr', { hasText: TEST_USER.email });
    await expect(ownRow).toBeVisible();

    await ownRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Ban' }).click();
    await expect(page.getByRole('heading', { name: /Ban/ })).toBeVisible();
    await page.locator('#ban-reason').fill('self-target e2e attempt');
    await page.getByRole('button', { name: 'Ban User' }).click();

    await expect(
      page.getByText(/cannot ban your own admin account/i)
    ).toBeVisible();
    await expect(ownRow.getByText('banned')).not.toBeVisible();

    // Admin session must still work after the rejected attempt - reload and
    // confirm the page (and the admin's own access) is unaffected.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(
      page.getByRole('heading', { name: 'User List' })
    ).toBeVisible();
    await expect(
      page.locator('tr', { hasText: TEST_USER.email })
    ).toBeVisible();
  });

  test('cannot delete own admin account', async ({ page }) => {
    const ownRow = page.locator('tr', { hasText: TEST_USER.email });
    await expect(ownRow).toBeVisible();

    await ownRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(
      page.getByRole('heading', { name: 'Delete user' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(
      page.getByText(/cannot delete your own admin account/i)
    ).toBeVisible();

    // Admin session must still work after the rejected attempt.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(
      page.getByRole('heading', { name: 'User List' })
    ).toBeVisible();
    await expect(
      page.locator('tr', { hasText: TEST_USER.email })
    ).toBeVisible();
  });
});
