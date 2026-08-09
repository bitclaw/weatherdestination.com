import { expect, test } from '@playwright/test';
import { loginAsOnboardingUser } from '../../helpers/auth';

test.skip(
  !process.env.LOADTEST_AUTH_ENABLED,
  'Set LOADTEST_AUTH_ENABLED=true in .env.e2e to run auth tests'
);

async function resetOnboarding(
  request: import('@playwright/test').APIRequestContext
) {
  const res = await request.post('/api/loadtest/reset-onboarding', {
    data: {
      email:
        process.env.LOADTEST_ONBOARDING_EMAIL ?? 'onboarding-test@example.com',
      password: process.env.LOADTEST_ONBOARDING_OTP
    }
  });
  if (!res.ok()) {
    throw new Error(
      `reset-onboarding failed: ${res.status()} ${await res.text()}`
    );
  }
}

// Regression: _landing/index.tsx's beforeLoad only redirected an
// authenticated visitor to their dashboard if onboarding was already
// complete - but before that check existed at all, a fresh signup (session
// present, onboardingComplete: false) fell through and rendered the public
// marketing page, complete with Login/Sign Up buttons, instead of
// /onboarding. This same beforeLoad runs on every navigation to '/', so one
// assertion covers a fresh post-login landing, a reload, and manually
// re-visiting '/' mid-onboarding alike - all three go through the identical
// code path.
test.describe('onboarding redirect', () => {
  test('authenticated but not-onboarded visitor is redirected off the landing page', async ({
    page,
    request
  }) => {
    await loginAsOnboardingUser(page);
    await resetOnboarding(request);

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL('/onboarding', { timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Sign Up' })).toHaveCount(0);

    // Re-visiting '/' mid-onboarding (reload or manual nav) must redirect
    // again, not show the marketing page on a second pass.
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL('/onboarding', { timeout: 10_000 });
  });
});
