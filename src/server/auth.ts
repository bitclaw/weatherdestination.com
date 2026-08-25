import { isDisposableEmail } from '@bitclaw/disposable-email';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';
import {
  admin as adminPlugin,
  captcha,
  emailOTP,
  genericOAuth,
  magicLink,
  multiSession,
  twoFactor
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

// Cookie name for a pending 2FA challenge - matches better-auth's own
// TWO_FACTOR_COOKIE_NAME (better-auth/dist/plugins/two-factor/constant.mjs),
// which is NOT re-exported from better-auth/plugins's public barrel, so this
// string is hardcoded here.
const TWO_FACTOR_COOKIE_NAME = 'two_factor';
const TWO_FACTOR_COOKIE_MAX_AGE = 600; // seconds - matches the plugin's own default

// Bridges better-auth's built-in 2FA sign-in gate, which only matches
// /sign-in/email|username|phone-number (credential auth) - confirmed
// directly against the installed better-auth@1.7.1 package's own matcher.
// This app is 100% passwordless (emailOTP/magicLink/social), so the
// built-in gate never fires for any sign-in path this app actually uses.
// Without this bridge, a 2FA-enabled user gets a fully valid session on
// email-OTP/magic-link/OAuth sign-in with no code prompt at all - a real
// auth bypass, not a UX gap. Replicates the built-in gate's own mechanism
// (better-auth/dist/plugins/two-factor/index.mjs) exactly: delete the
// session that was just created, write a pending-2FA verification record +
// signed cookie in the same shape the plugin's own verify-totp/
// verify-backup-code endpoints already know how to read (see
// verify-two-factor.mjs's no-session branch).
//
// Returns true if a challenge was created (caller must not let the original
// session/response stand), false if 2FA isn't enabled for this user (caller
// does nothing further).
export const bridgeTwoFactorChallenge = async (
  ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0],
  // Injectable with a real default so this function's own logic - the
  // verification-record + cookie writes - is unit-testable without needing
  // a fake ctx that also satisfies deleteSessionCookie's much larger
  // internal ctx.context.authCookies/oauthConfig/options requirement.
  deleteSessionCookieFn: typeof deleteSessionCookie = deleteSessionCookie
): Promise<boolean> => {
  const data = ctx.context.newSession;
  if (!data?.user.twoFactorEnabled) return false;

  deleteSessionCookieFn(ctx, true);
  await ctx.context.internalAdapter.deleteSession(data.session.token);
  ctx.context.setNewSession(null);

  const twoFactorCookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME, {
    maxAge: TWO_FACTOR_COOKIE_MAX_AGE
  });
  const identifier = `2fa-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + TWO_FACTOR_COOKIE_MAX_AGE * 1000);

  await ctx.context.internalAdapter.createVerificationValue({
    value: data.user.id,
    identifier,
    expiresAt
  });
  // The plugin's own beginAttempt() (verify-two-factor.mjs) requires this
  // companion record to exist - without it every verify call fails with
  // INVALID_TWO_FACTOR_COOKIE regardless of the code entered.
  await ctx.context.internalAdapter.createVerificationValue({
    value: '0',
    identifier: `2fa-attempts-${identifier}`,
    expiresAt
  });
  await ctx.setSignedCookie(
    twoFactorCookie.name,
    identifier,
    ctx.context.secret,
    twoFactorCookie.attributes
  );

  return true;
};

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
      verification: schema.verifications,
      twoFactor: schema.twoFactor
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
      if (ctx.path === '/admin/impersonate-user') {
        // Durable, unconditional audit write - fires whenever better-auth's
        // own endpoint actually creates an impersonation session, regardless
        // of whether the client called this app's adminImpersonateUserFn
        // first (see admin-audit-log.server.ts's header comment for why
        // that function alone can't be the audit trail).
        const adminUserId = ctx.context.session?.user.id;
        const targetUserId = (ctx.body as { userId?: string } | undefined)
          ?.userId;
        if (!adminUserId || !targetUserId) return;
        await recordAdminAuditEvent(db, {
          type: 'admin.impersonation.started',
          adminUserId,
          targetUserId
        });
        return;
      }

      // Branch A - email-OTP sign-in. JSON response path: the client's
      // authClient.signIn.emailOtp() call reads this shape directly.
      if (ctx.path === '/sign-in/email-otp') {
        const challenged = await bridgeTwoFactorChallenge(ctx);
        if (!challenged) return;
        return ctx.json({
          twoFactorRedirect: true,
          twoFactorMethods: ['totp']
        });
      }

      // Branch B - magic-link verify. Redirect path: this is a plain GET
      // hit from the emailed link, no client JS in the loop, so the
      // challenge has to be a redirect override, not a JSON body. The
      // original destination is a plain, publicly-readable query param on
      // this same request (ctx.query.callbackURL).
      if (ctx.path === '/magic-link/verify') {
        const challenged = await bridgeTwoFactorChallenge(ctx);
        if (!challenged) return;
        const callbackURL =
          typeof ctx.query?.callbackURL === 'string'
            ? ctx.query.callbackURL
            : '/';
        throw ctx.redirect(
          `/two-factor?redirectTo=${encodeURIComponent(callbackURL)}`
        );
      }

      // Branch C - social/OAuth callback (all providers: Google/GitHub/
      // GitLab built-in social, Bitbucket via genericOAuth - one branch
      // covers every provider via the shared /callback/:id path prefix).
      // Same bypass class as Branch A/B: better-auth's built-in 2FA gate
      // never matches OAuth callbacks either. Unlike magic-link, the
      // original destination here is embedded in a signed `state` param
      // this app doesn't have a public API to re-parse, so this
      // deliberately does not carry a redirectTo through - the post-2FA
      // destination falls back to the app's standard post-login landing
      // page instead of the OAuth-specific one.
      if (ctx.path.startsWith('/callback/')) {
        const challenged = await bridgeTwoFactorChallenge(ctx);
        if (!challenged) return;
        throw ctx.redirect('/two-factor');
      }
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
    twoFactor({
      issuer: config.appName,
      // Mandatory: this app has zero password auth anywhere (OTP/magic-link/
      // social only). Without this, enable/disable hard-require a `password`
      // field this app's users can never supply.
      allowPasswordless: true,
      backupCodeOptions: { amount: 10, length: 8 }
      // skipVerificationOnEnable left at its default (false): require a
      // confirmed working TOTP code before 2FA goes live, avoids
      // self-lockout. otpOptions/accountLockout left unset: library
      // defaults apply (accountLockout is on by default in 1.7.1, locks 15
      // min after 10 failed verifications).
    }),
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
