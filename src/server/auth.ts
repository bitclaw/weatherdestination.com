import { isDisposableEmail } from '@bitclaw/disposable-email';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import {
  admin as adminPlugin,
  captcha,
  emailOTP,
  genericOAuth,
  magicLink,
  multiSession
} from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { eq } from 'drizzle-orm';
import { config } from '@/config';
import { recordAdminAuditEvent } from '@/features/admin/server/admin-audit-log.server';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { onUserCreatedSafely } from './auth-hooks';
import { sendEmail } from './email';
import { MagicLinkEmail, OtpEmail } from './email-templates';
import { getTurnstileProtectedEndpoints } from './turnstile-endpoints';

const adminEmails = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

const method = config.auth.verificationMethod;
const useOtp = method === 'otp' || method === 'both';
const useMagicLink = method === 'magic-link' || method === 'both';

const isDev = process.env.NODE_ENV !== 'production';

// Stored in globalThis so it survives HMR , same pattern as better-auth's own global state.
// Prevents duplicate welcome email enqueues when the hook fires multiple times per signup.
const welcomeEnqueued: Set<string> =
  ((globalThis as Record<symbol, unknown>)[
    Symbol.for('warpkit:welcome-enqueued')
  ] as Set<string> | undefined) ?? new Set<string>();
(globalThis as Record<symbol, unknown>)[
  Symbol.for('warpkit:welcome-enqueued')
] = welcomeEnqueued;

export const auth = betterAuth({
  baseURL: isDev
    ? {
        allowedHosts: ['localhost:*', '127.0.0.1:*'],
        fallback: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
        protocol: 'http'
      }
    : (process.env.BETTER_AUTH_URL ?? `https://${config.domainName}`),
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!
          }
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!
          }
        }
      : {}),
    ...(process.env.GITLAB_CLIENT_ID
      ? {
          gitlab: {
            clientId: process.env.GITLAB_CLIENT_ID!,
            clientSecret: process.env.GITLAB_CLIENT_SECRET!
          }
        }
      : {})
  },
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications
    }
  }),
  advanced: {
    cookiePrefix: config.appName.toLowerCase()
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user: { id: string; email: string; name: string }) => {
          // Seed role='admin' immediately for ADMIN_EMAILS users, rather
          // than relying solely on requireAdmin()'s lazy first-access
          // promotion (require-admin.ts). Closes the window between signup
          // and first /dashboard/admin visit where a freshly-added admin
          // still has role='user' in the DB - better-auth's own
          // impersonation guard checks that column directly, and only
          // blocks impersonating a target whose role is already 'admin'.
          if (adminEmails.includes(user.email)) {
            await db
              .update(schema.users)
              .set({ role: 'admin' })
              .where(eq(schema.users.id, user.id));
          }
          if (welcomeEnqueued.has(user.id)) return;
          welcomeEnqueued.add(user.id);
          await onUserCreatedSafely(db, user);
        }
      }
    }
  },
  hooks: {
    // Top-level hooks.after is a single AuthMiddleware (unlike a plugin's
    // own hooks.after, which is an array of {matcher, handler} - the shape
    // used internally by better-auth's admin plugin, easy to copy by
    // mistake since it looks similar), so the path match happens inside the
    // one handler instead of via a separate matcher function.
    after: createAuthMiddleware(async ctx => {
      if (ctx.path !== '/admin/impersonate-user') return;
      // Durable, unconditional audit write - fires whenever better-auth's
      // own endpoint actually creates an impersonation session, regardless
      // of whether the client called this app's adminImpersonateUserFn
      // first (see admin-audit-log.server.ts's header comment for why that
      // function alone can't be the audit trail).
      const adminUserId = ctx.context.session?.user.id;
      const targetUserId = (ctx.body as { userId?: string } | undefined)
        ?.userId;
      if (!adminUserId || !targetUserId) return;
      await recordAdminAuditEvent(db, {
        type: 'admin.impersonation.started',
        adminUserId,
        targetUserId
      });
    })
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    cookieCache: {
      enabled: true,
      // The cookie cache validates a session straight from the signed
      // cookie with no DB lookup, so revocation (adminRevokeSessionsFn,
      // authClient.revokeSession/revokeOtherSessions, ban) isn't actually
      // effective until the cached cookie expires - a stolen/compromised
      // session stays fully functional for up to this long after being
      // "revoked". 60s (down from 5min) shrinks that window; a per-user
      // revocation-version bump would close it entirely but is a bigger
      // change (new column, threading through every revoke path) - not
      // done here, this is the documented interim mitigation.
      maxAge: 60
    }
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    // Matches better-auth's own built-in hardened default for these paths
    // (getDefaultSpecialRules(): window 60, max 3) - these had been loosened
    // to max 10, weaker than the library's own default for no documented
    // reason.
    customRules: {
      '/email-otp/send-verification-otp': { window: 60, max: 3 },
      '/sign-in/email-otp': { window: 60, max: 3 },
      '/email-otp/send-signin-otp': { window: 60, max: 3 },
      '/sign-in/magic-link': { window: 60, max: 3 }
    }
  },
  plugins: [
    ...(useOtp
      ? [
          emailOTP({
            async sendVerificationOTP({ email, otp }) {
              if (isDisposableEmail(email))
                throw new Error('Disposable email addresses are not allowed');
              // Code intentionally NOT in the subject line - subjects render
              // in lock-screen/desktop notification previews (shoulder-
              // surfing without unlocking the device) and are retained by
              // mail-relay/log metadata far more casually than bodies.
              const result = await sendEmail({
                to: email,
                subject: `Your ${config.appName} login code`,
                react: OtpEmail({ otp, appName: config.appName })
              });
              if (!result.ok) {
                throw new Error(result.message);
              }
            }
          })
        ]
      : []),
    ...(useMagicLink
      ? [
          magicLink({
            sendMagicLink: async ({ email, url }) => {
              if (isDisposableEmail(email))
                throw new Error('Disposable email addresses are not allowed');
              const result = await sendEmail({
                to: email,
                subject: `Sign in to ${config.appName}`,
                react: MagicLinkEmail({ url, appName: config.appName })
              });
              if (!result.ok) {
                throw new Error(result.message);
              }
            }
          })
        ]
      : []),
    adminPlugin({ defaultRole: 'user' }),
    multiSession({ maximumSessions: 5 }),
    tanstackStartCookies(),
    ...(process.env.BITBUCKET_CLIENT_ID
      ? [
          genericOAuth({
            config: [
              {
                providerId: 'bitbucket',
                clientId: process.env.BITBUCKET_CLIENT_ID!,
                clientSecret: process.env.BITBUCKET_CLIENT_SECRET!,
                authorizationUrl: 'https://bitbucket.org/site/oauth2/authorize',
                tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
                userInfoUrl: 'https://api.bitbucket.org/2.0/user',
                scopes: ['account', 'email'],
                getUserInfo: async token => {
                  const res = await fetch(
                    'https://api.bitbucket.org/2.0/user',
                    {
                      headers: {
                        Authorization: `Bearer ${token.accessToken}`
                      }
                    }
                  );
                  const data = (await res.json()) as {
                    account_id: string;
                    display_name: string;
                    nickname: string;
                    links?: { avatar?: { href?: string } };
                  };
                  return {
                    id: data.account_id,
                    name: data.display_name,
                    email: `${data.account_id}@bitbucket.placeholder`,
                    emailVerified: false,
                    image: data.links?.avatar?.href ?? undefined
                  };
                }
              }
            ]
          })
        ]
      : []),
    ...(process.env.TURNSTILE_SECRET_KEY
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: process.env.TURNSTILE_SECRET_KEY,
            endpoints: getTurnstileProtectedEndpoints(method)
          })
        ]
      : [])
  ]
});

export type Auth = typeof auth;
