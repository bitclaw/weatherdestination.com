import { describe, expect, it } from 'bun:test';
import { adminAc } from 'better-auth/plugins/admin/access';

// Regression test for a security property that currently holds only by
// relying on better-auth's own defaults, not anything this app asserts:
// admin.mutations.ts:244 (`adminImpersonateUserFn`) audits impersonation
// attempts, but the actual block on impersonating another admin lives
// entirely inside better-auth's admin plugin (routes.mjs `impersonateUser`),
// which requires the caller's role to carry the `impersonate-admins`
// permission whenever the target's role is in `adminRoles` (default `['admin']`).
//
// `adminPlugin({ defaultRole: 'user' })` in src/server/auth.ts does not set
// `roles`, `adminRoles`, or `allowImpersonatingAdmins`, so our admin users
// (role: 'admin') get better-auth's built-in `adminAc` role. This test pins
// that role's actual permission set so a future better-auth upgrade, or a
// change to that adminPlugin(...) call, can't silently reopen admin-on-admin
// impersonation without a test failing here first.
describe('admin impersonation guard (better-auth adminAc role)', () => {
  it('does not grant impersonate-admins to the default admin role', () => {
    const result = adminAc.authorize({ user: ['impersonate-admins'] });
    expect(result.success).toBe(false);
  });

  it('still grants plain impersonate to the default admin role', () => {
    const result = adminAc.authorize({ user: ['impersonate'] });
    expect(result.success).toBe(true);
  });
});
