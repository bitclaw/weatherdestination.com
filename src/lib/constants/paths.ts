export const PATHS = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  SETTINGS: '/settings',
  BILLING: '/billing',
  ADMIN: '/admin',
  ONBOARDING: '/onboarding',
  BLOG: '/blog'
} as const;

export type AppPath = (typeof PATHS)[keyof typeof PATHS];

// Requires a single leading slash (rejects protocol-relative `//evil.com`
// and absolute URLs), then rejects backslash and percent-encoded
// slash/backslash (`%2f`, `%5c`) ANYWHERE in the value - not just checking
// the prefix, since the previous version's `startsWith('/') &&
// !startsWith('//')` missed the backslash-normalization bypass browsers
// perform: a value like `/\evil.com` starts with a single `/`, but
// Chrome/Safari normalize the `\` to `/`, turning it protocol-relative
// (`https://evil.com`) once resolved. Query strings (`?tab=billing`) are
// still allowed - only the backslash/encoded-slash family is denied, not
// the ordinary URL charset. Mirrors the rejection set better-auth's own
// trusted-origin check uses for callbackURL.
export const sanitizeRedirectPath = (
  value: string | undefined
): string | undefined => {
  if (!value?.startsWith('/') || value.startsWith('//')) {
    return undefined;
  }
  if (/\\|%2f|%5c/i.test(value)) return undefined;
  return value;
};
