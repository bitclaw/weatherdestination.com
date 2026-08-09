import type { Page } from '@playwright/test';
import { SESSION_COOKIE_NAME } from '@/config';

async function _loginAs(
  page: Page,
  email: string | undefined,
  password: string | undefined
) {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

  const res = await page.request.post('/api/loadtest/auth', {
    data: { email, password }
  });

  if (!res.ok()) {
    throw new Error(
      `loadtest auth failed: ${res.status()} ${await res.text()}`
    );
  }

  // Parse signed cookie value from Set-Cookie header.
  // better-auth uses signed cookies: encodeURIComponent(`${token}.${base64(HMAC-SHA256(token,secret))}`).
  // Raw token is rejected , must use the decoded signed form as the cookie value.
  const setCookieHeader = res.headers()['set-cookie'] ?? '';
  const rawValue =
    setCookieHeader.split(';')[0]?.split('=').slice(1).join('=') ?? '';
  const cookieValue = decodeURIComponent(rawValue);

  if (!cookieValue) {
    throw new Error(`loadtest auth: no Set-Cookie header in response`);
  }

  // url infers domain+path; don't mix with domain/path fields
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: cookieValue,
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax'
    }
  ]);
}

export async function loginAsTestUser(page: Page) {
  return _loginAs(page, process.env.LOADTEST_EMAIL, process.env.LOADTEST_OTP);
}

// Standing "not yet onboarded" test user - see
// src/routes/api/loadtest/auth.ts and reset-onboarding.ts. Distinct
// credentials from loginAsTestUser so this user's onboarding state can be
// reset between tests without disturbing every other test that expects
// onboardingComplete: true.
export async function loginAsOnboardingUser(page: Page) {
  return _loginAs(
    page,
    process.env.LOADTEST_ONBOARDING_EMAIL,
    process.env.LOADTEST_ONBOARDING_OTP
  );
}
