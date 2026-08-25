import { describe, expect, it, mock } from 'bun:test';
import { bridgeTwoFactorChallenge } from './auth';

// bridgeTwoFactorChallenge bridges better-auth's built-in 2FA sign-in gate,
// which only matches /sign-in/email|username|phone-number (confirmed
// against the installed better-auth@1.7.1 package) - this app is 100%
// passwordless, so that gate never fires for any path this app uses.
// Branches A/B/C in auth.ts's hooks.after all delegate the actual
// session-deletion/pending-cookie work to this one function; testing it in
// isolation covers all three call sites without needing to drive a real
// request through better-auth's full HTTP pipeline (auth.ts's betterAuth()
// instance is a module-level singleton bound to the app DB, not designed
// for per-test injection - see makeTestSharedDb()'s doc comment for why
// server functions generally aren't tested this way).
//
// The fake `ctx` below is a hand-built object satisfying only the subset of
// better-auth's AuthMiddleware context this function actually calls -
// sanctioned dependency injection against an already-tested external
// library (better-auth itself), not a mock of this app's own DB.
const makeFakeCtx = (twoFactorEnabled: boolean) => {
  const deleteSession = mock(() => Promise.resolve());
  const createVerificationValue = mock(() => Promise.resolve());
  const setNewSession = mock(() => {});
  const setSignedCookie = mock(() => Promise.resolve());

  const ctx = {
    context: {
      newSession: {
        user: { id: 'user_123', twoFactorEnabled },
        session: { token: 'session_token_abc' }
      },
      internalAdapter: { deleteSession, createVerificationValue },
      setNewSession,
      createAuthCookie: (name: string, opts?: { maxAge?: number }) => ({
        name,
        attributes: { maxAge: opts?.maxAge }
      }),
      secret: 'test-secret'
    },
    setSignedCookie
  };

  // better-auth's real deleteSessionCookie needs a much larger ctx
  // (ctx.context.authCookies/oauthConfig/options, cookie-store helpers) -
  // this function's own contract with it is just "call it once with the
  // request ctx and skipDontRememberMe=true", which is what's under test
  // here, not deleteSessionCookie's own internals (that's better-auth's
  // job, already covered by its own test suite).
  const deleteSessionCookieFn = mock(() => {});

  return {
    ctx,
    deleteSession,
    createVerificationValue,
    setNewSession,
    setSignedCookie,
    deleteSessionCookieFn
  };
};

describe('bridgeTwoFactorChallenge', () => {
  it('returns false and does nothing when the user does not have 2FA enabled', async () => {
    const { ctx, deleteSession, createVerificationValue, setNewSession } =
      makeFakeCtx(false);

    const result = await bridgeTwoFactorChallenge(ctx as any);

    expect(result).toBe(false);
    expect(deleteSession).not.toHaveBeenCalled();
    expect(createVerificationValue).not.toHaveBeenCalled();
    expect(setNewSession).not.toHaveBeenCalled();
  });

  it('deletes the session and writes a pending-2FA verification + cookie when 2FA is enabled', async () => {
    const {
      ctx,
      deleteSession,
      createVerificationValue,
      setNewSession,
      setSignedCookie,
      deleteSessionCookieFn
    } = makeFakeCtx(true);

    const result = await bridgeTwoFactorChallenge(
      ctx as any,
      deleteSessionCookieFn
    );

    expect(result).toBe(true);
    expect(deleteSessionCookieFn).toHaveBeenCalledWith(ctx, true);
    expect(deleteSession).toHaveBeenCalledWith('session_token_abc');
    expect(setNewSession).toHaveBeenCalledWith(null);

    // Two verification records must be written: the pending-2FA identifier
    // itself, and the companion attempts-counter record. better-auth's own
    // beginAttempt() (verify-two-factor.mjs) throws
    // INVALID_TWO_FACTOR_COOKIE on every verify call if the attempts record
    // is missing, regardless of whether the submitted code is correct -
    // this is the single easiest piece of this bridge to silently drop.
    expect(createVerificationValue).toHaveBeenCalledTimes(2);
    const [[mainRecord], [attemptsRecord]] = createVerificationValue.mock
      .calls as unknown as [
      [{ value: string; identifier: string }],
      [{ value: string; identifier: string }]
    ];
    expect(mainRecord.value).toBe('user_123');
    expect(attemptsRecord.value).toBe('0');
    expect(attemptsRecord.identifier).toBe(
      `2fa-attempts-${mainRecord.identifier}`
    );

    // The cookie written must carry the SAME identifier as the main
    // verification record, under the literal 'two_factor' cookie name -
    // this is the un-exported constant better-auth's own verifyTotp/
    // verifyBackupCode endpoints read back (constant.mjs, not re-exported
    // from better-auth/plugins's public barrel).
    expect(setSignedCookie).toHaveBeenCalledWith(
      'two_factor',
      mainRecord.identifier,
      'test-secret',
      expect.anything()
    );
  });
});
