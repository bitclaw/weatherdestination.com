import { expect, test } from '@playwright/test';

// Verifies the mechanics of installChunkReloadGuard (src/lib/chunk-reload-guard.ts):
// a chunk-load-failure error message triggers exactly one page reload, not a loop.
// Does not (and can't, in an e2e run against a single build) reproduce the actual
// deploy-skew race that causes a real chunk-load failure in production.

test('chunk-load error message triggers a single reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  // installChunkReloadGuard() runs on client hydration, which lands slightly
  // after the initial document/body paint - wait for it before dispatching,
  // or the listener isn't registered yet and the event is a no-op.
  await page.waitForLoadState('networkidle');

  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          message: 'Failed to fetch dynamically imported module'
        })
      );
    })
  ]);

  await expect(page.locator('body')).toBeVisible();

  const flag = await page.evaluate(() =>
    sessionStorage.getItem('runmist:chunk-reload-attempted')
  );
  expect(flag).toBe('1');
});

test('an unrelated error message does not trigger a reload', async ({
  page
}) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  // installChunkReloadGuard() runs on client hydration, which lands slightly
  // after the initial document/body paint - wait for it before dispatching,
  // or the listener isn't registered yet and the event is a no-op.
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'x.find is not a function' })
    );
  });

  // No matching-message error occurred, so no reload should follow; give it
  // a moment to (not) happen rather than asserting on a fixed zero-time race.
  await page.waitForTimeout(500);

  const flag = await page.evaluate(() =>
    sessionStorage.getItem('runmist:chunk-reload-attempted')
  );
  expect(flag).toBeNull();
});
