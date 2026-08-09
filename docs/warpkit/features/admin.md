# Admin Panel

Warpkit ships with a built-in admin panel at `/dashboard/admin` for managing users, subscriptions, and access control.

## Access control

Admins are defined by email address via the `ADMIN_EMAILS` environment variable:

```bash
ADMIN_EMAILS=alice@myapp.com,bob@myapp.com
```

Comma-separated. Any request to an admin server function from an email not in this list returns `403 Forbidden`. `role` is seeded to `'admin'` at signup for a matching email (`databaseHooks.user.create.after` in `src/server/auth.ts`), and `requireAdmin()` also auto-promotes on every call as a fallback for accounts that existed before this seeding was added, so better-auth's own role checks (`auth.api.*`, the admin plugin's `/api/auth/admin/*` routes) stay consistent with the env-var source of truth as early as possible , the signup-time seed specifically closes the window where a freshly-added admin who hasn't visited `/dashboard/admin` yet still has `role='user'` and so isn't recognized as an admin by better-auth's own impersonation guard (see Impersonation below).

An impersonated session can never itself pass `requireAdmin()` in this app's own server functions, regardless of the impersonated user's role , `session.session.impersonatedBy` is checked and rejected before anything else. This does not extend to better-auth's own `/api/auth/admin/*` routes, which are a separate surface with their own role-based authorization.

## What the admin panel shows

- All registered users, with pagination and search
- Each user's email, name, role, plan (free/pro), and access/ban status
- Account creation date
- A per-user detail view (`/dashboard/admin/$userId`) with role, sessions, and danger-zone actions

## Actions

| Action | Description |
|--------|-------------|
| Toggle access | Enable or disable a user's access (`hasAccess` flag) |
| Set role | Promote/demote a user between `user` and `admin` |
| Ban / unban | Suspend a user's sessions, with an optional reason and expiry |
| Revoke sessions | Force-log-out all of a user's active sessions |
| Create user | Create a new user directly (temp password, never surfaced to the admin) |
| Invite user | Send a magic-link invite (requires `verificationMethod: 'magic-link' | 'both'` in `config.ts`) |
| Impersonate | Sign in as another user without their password , see below |
| Delete user | Cancels Stripe subscription, deletes user DB, removes from shared DB |

## Impersonation

**This is the highest-privilege admin action in the app** , it grants full session access to another user's account with a plain admin-role check and no additional reauth step. Treat any admin account as equivalent in blast radius to every non-admin user it can impersonate.

Impersonating another *admin* is blocked, but not by anything this app configures: better-auth's admin plugin checks the target's role against `adminRoles` (default `['admin']`) and requires the caller to hold the `impersonate-admins` permission, which its built-in `admin` role does not grant. `src/server/auth.ts`'s `adminPlugin({ defaultRole: 'user' })` call doesn't override `roles`, `adminRoles`, or `allowImpersonatingAdmins`, so this protection is real today but rests entirely on an upstream default. `src/server/admin-impersonation-guard.test.ts` pins that default so a future better-auth upgrade or a change to that `adminPlugin(...)` call can't silently reopen it without a test failing first.

Client-side flow only (`src/features/admin/pages/index.tsx`, `detail.tsx`): `authClient.admin.impersonateUser({ userId })` swaps the browser's session cookie to the target user via better-auth's admin plugin. It must run client-side , setting the cookie from a server function response doesn't propagate to the browser the same way.

The resulting session carries an `impersonatedBy` field (see `sessions.impersonatedBy` in `schema.ts`) pointing back at the admin's user ID. `src/pages/AppLayout.tsx` reads this off the current session and renders a persistent banner ("Impersonating as {email}") with a **Stop impersonating** button that calls `authClient.admin.stopImpersonating()` to restore the admin's own session.

Impersonation **start** is audited durably and unconditionally: a better-auth `hooks.after` matcher on `/admin/impersonate-user` (`src/server/auth.ts`) writes a row to the shared `admin_audit_log` table (`recordAdminAuditEvent`, `src/features/admin/server/admin-audit-log.server.ts`) whenever that endpoint actually creates an impersonation session , this fires regardless of whether the client called `adminImpersonateUserFn` first, since that function is only a rate-limited self-target pre-check the client can skip by calling `authClient.admin.impersonateUser` directly. `adminImpersonateUserFn`'s own `admin.impersonation.started` domain-event emit is a best-effort early signal, not the audit trail. Impersonation **stop** is still unaudited , if you need that, add a second `hooks.after` matcher for `/admin/stop-impersonating`.

## Server functions

Queries in `src/features/admin/server/admin.queries.ts`, mutations in `src/features/admin/server/admin.mutations.ts`.

| Function | Method | Description |
|----------|--------|-------------|
| `getAdminUsers` | GET | List all users with plan and access status (paginated, searchable) |
| `adminToggleAccess` | POST | Set `hasAccess` for a user |
| `adminSetRole` | POST | Set a user's role via `auth.api.setRole` |
| `adminBanUser` / `adminUnbanUser` | POST | Ban/unban via `auth.api.banUser` / `unbanUser` |
| `adminRevokeSessions` | POST | Force-revoke all sessions via `auth.api.revokeUserSessions` |
| `adminListUserSessions` | POST | List a user's active sessions |
| `adminCreateUser` | POST | Create a user via `auth.api.createUser` |
| `adminInviteUser` | POST | Send a magic-link invite via `auth.api.signInMagicLink` |
| `adminDeleteUser` | POST | Full user deletion (durable job, see `docs/warpkit/features/durable-operations.md` equivalent) |

All `userId` inputs are validated with `userIdSchema` (`admin.mutations.ts`) , a regex matching better-auth's actual ID shape (32-char alphanumeric via `generateId()`), not a UUID format. Don't tighten this to `z.string().uuid()`; better-auth doesn't generate UUIDs by default and doing so would reject every real user ID.

## Using `hasAccess` for gating

The `hasAccess` column on the `users` table lets you manually grant or revoke access independently of the Stripe subscription. Useful for:

- Free beta invites
- Banned users
- Grandfathered accounts

Check it server-side:

```ts
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
if (!user?.hasAccess) return err(ERROR_CODES.FORBIDDEN, 'Access required');
```

## Pure query functions

`queryAdminUsers` and `setUserAccess` are exported as pure functions for use in tests:

```ts
import { queryAdminUsers, setUserAccess } from '@/features/admin/server/admin.server';

// In tests
const users = await queryAdminUsers(testDb);
await setUserAccess(testDb, userId, true);
```

## Analytics dashboard

`/dashboard/admin/analytics` (`queryAdminAnalytics` in `src/features/admin/server/admin-analytics.server.ts`) is backed by real data, not the shadcn-admin sample data it originally shipped with. What's real vs. structurally limited:

- **Current-snapshot metrics** (MRR, active subscribers, trials active, plan distribution, ARPU) are computed live from the `subscriptions` table on every request , always accurate as of now.
- **Recurring payments** (`payments` table) are populated by the `invoice.paid` webhook handler (`handleInvoicePaid` in `stripe-subscription.server.ts`), distinct from `purchases` (one-time/credits checkouts only). Deduplicated on `stripeInvoiceId`, safe against webhook redelivery.
- **MRR trend chart** reads from `mrr_snapshots`, populated by the `analytics:snapshot-mrr` cron job (daily, idempotent per calendar month , see `src/features/jobs/scheduler.server.ts`). Months before this feature shipped have no snapshot and are not backfilled: the chart only shows real history forward from whenever the job starts running.
- **Subscriber growth (new vs. cancelled by month)** buckets `subscriptions.createdAt` and `subscriptions.cancelledAt`. `cancelledAt` is set once, on `customer.subscription.deleted` , subscriptions cancelled before this column existed show 0 for their cancellation month even though the cancellation was real.
- **Refunds** count only one-time/credits refunds (`purchases.refundedAt`). Subscription refunds have no persisted record (see `stripe-refund.server.ts`'s `handleSubscriptionRefundFallback` comment) , this is a known undercount, not a bug.
- **Churn rate** is cancellations this calendar month divided by (active + cancelled this month) , a simple approximation, not a cohort-based churn calculation.
