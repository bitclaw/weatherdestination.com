import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe.configure({ mode: 'serial' });
test.describe('uploads page', () => {
  test.skip(
    !process.env.LOADTEST_AUTH_ENABLED,
    'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
  );

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/uploads', { waitUntil: 'networkidle' });
  });

  // No AWS_S3_* configured in this environment, so the real upload flow
  // (presign -> direct S3 PUT -> addUploadToDbFn) can't be exercised without
  // real bucket credentials. Covers the config gate itself instead: either the
  // real upload UI renders, or the SetupCard does - never neither.
  test('renders either the upload UI or the not-configured setup card', async ({
    page
  }) => {
    await expect(page.getByRole('heading', { name: 'Files' })).toBeVisible();

    const uploadButton = page.getByRole('button', { name: 'Upload file' });
    const setupCard = page.getByRole('heading', {
      name: 'File uploads not configured'
    });

    await expect(uploadButton.or(setupCard)).toBeVisible();
  });
});
