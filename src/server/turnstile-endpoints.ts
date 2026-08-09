import type { AppConfig } from '@/config';

// better-auth's captcha plugin only calls Cloudflare's siteverify on paths
// listed in `endpoints` (defaulting to password-auth routes: /sign-up/email,
// /sign-in/email, /request-password-reset -- see
// node_modules/better-auth/dist/plugins/captcha/constants.mjs). This app is
// passwordless (otp/magic-link only), so none of those defaults are ever
// hit and siteverify was never actually being called in production --
// confirmed via Cloudflare's own dashboard warning ("Siteverify isn't being
// called for Runmist"). The Turnstile widget rendered and issued real
// tokens client-side the whole time; the server just never checked them,
// so the captcha was decorative. This computes the real send-a-code
// endpoints for whichever verification method(s) are actually enabled.
export const getTurnstileProtectedEndpoints = (
  method: AppConfig['auth']['verificationMethod']
): string[] => {
  const endpoints: string[] = [];
  if (method === 'otp' || method === 'both') {
    endpoints.push('/email-otp/send-verification-otp');
  }
  if (method === 'magic-link' || method === 'both') {
    endpoints.push('/sign-in/magic-link');
  }
  return endpoints;
};
