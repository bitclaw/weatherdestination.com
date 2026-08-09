import { expect, test } from '@playwright/test';

// Regression: login/signup pages used to share one isLoading flag across the
// email-OTP flow and both social buttons. Clicking Continue with Google set
// isLoading true, which flipped the unrelated Email button to disabled
// "Sending code..." even though no email send was happening. GOOGLE_CLIENT_ID
// (fake, see .env.e2e) is set specifically so this button renders in e2e.

test.describe('login page social/email button isolation', () => {
  test('clicking Continue with Google does not disable or relabel the Email button', async ({
    page
  }) => {
    await page.goto('/login');
    // installChunkReloadGuard-style gotcha (see chunk-reload-guard.spec.ts):
    // hydration lands slightly after first paint. Filling the email input
    // before it completes sets the raw DOM value without React's onChange
    // ever firing, leaving `email` state stuck at '' and the button stuck
    // disabled regardless of what's actually typed.
    await page.waitForLoadState('networkidle');

    // Hang the social sign-in request indefinitely so the in-flight loading
    // state is inspectable before better-auth would redirect away.
    await page.route('**/api/auth/sign-in/social', async () => {
      await new Promise(() => {});
    });

    // The email form starts collapsed behind a "Continue with Email ->"
    // toggle - reveal it first.
    await page.getByRole('button', { name: 'Continue with Email →' }).click();

    const googleButton = page.getByRole('button', {
      name: /continue with google/i
    });
    const emailInput = page.getByLabel('Email Address');
    const emailButton = page.getByRole('button', {
      name: 'Continue with Email'
    });

    // Email button is legitimately disabled while the field is empty -
    // fill it so the only thing that can disable it afterward is loading
    // state, isolating the actual regression being tested.
    await emailInput.fill('crosstalk-test@example.com');
    await expect(emailButton).toBeEnabled();
    await googleButton.click();

    // aria-label is static ("Continue with Google"), so accessible-name
    // locators can't see the "Redirecting..." text swap - assert on the
    // already-located button's own text content instead.
    await expect(googleButton).toBeDisabled();
    await expect(googleButton).toContainText('Redirecting...');

    // The actual regression: the Email button must stay in its idle state,
    // not flip to disabled "Sending code..." because of the Google click.
    await expect(emailButton).toBeVisible();
    await expect(emailButton).toHaveText('Continue with Email');

    // It's still fine (and expected) for the email input itself to be
    // disabled while any auth flow is in progress - just not relabeled.
    await expect(emailInput).toBeDisabled();
  });
});
