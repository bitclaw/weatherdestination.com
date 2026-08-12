// Server-side Cloudflare Turnstile verification for custom routes that
// aren't behind better-auth's own captcha plugin (src/server/auth.ts) -
// e.g. the public lead-capture endpoint. Request/response shape verified
// against better-auth's own installed implementation
// (node_modules/better-auth/dist/plugins/captcha/verify-handlers/cloudflare-turnstile.mjs).
const DEFAULT_VERIFY_TIMEOUT_MS = 10_000;

export const verifyTurnstileToken = async (
  token: string,
  remoteIp?: string,
  timeoutMs: number = DEFAULT_VERIFY_TIMEOUT_MS
): Promise<boolean> => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return true; // not configured - skip, matches the "activates via env var" convention

  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
          ...(remoteIp && { remoteip: remoteIp })
        }),
        signal: AbortSignal.timeout(timeoutMs)
      }
    );
    if (!res.ok) return false;

    const data = (await res.json()) as { success: boolean };
    return data.success;
  } catch {
    // Network error or timeout - fail closed, this is a security check.
    return false;
  }
};

/**
 * Turnstile is fail-open at the caller's discretion (login/signup OTP
 * send): a widget that never got a chance to run (blocked script,
 * timeout) shouldn't block a real signup, but a token that was actually
 * provided and failed verification is a real signal, not a loading
 * failure, and still blocks. Pure so the distinction is unit-testable
 * without a network call.
 */
export function shouldProceedWithoutBlocking(
  hasToken: boolean,
  verified: boolean
): boolean {
  if (!hasToken) return true;
  return verified;
}
