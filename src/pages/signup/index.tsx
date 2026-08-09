import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

type LastUsedMethod = 'email' | 'google' | 'github';
const LAST_METHOD_KEY = 'auth:lastMethod';

import { ErrorBanner } from '@/components/ui/error-banner';
import { config } from '@/config';
import { useCaptcha } from '@/features/captcha';
import { validateEmail } from '@/features/email-validation';
import { authClient } from '@/lib/auth-client';
import { PATHS } from '@/lib/constants';
import { bootstrapQueryKey } from '@/lib/query-keys';

const appName = config.appName;
const turnstileEnabled = config.auth.turnstile.enabled;
const verificationMethod = config.auth.verificationMethod;
const { google: googleEnabled, github: githubEnabled } =
  config.auth.socialProviders;
const hasSocialProviders = googleEnabled || githubEnabled;

export function SignupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { redirect: redirectTo } = useSearch({ from: '/_auth/signup' });
  const destination = redirectTo ?? PATHS.DASHBOARD;
  const [step, setStep] = useState<
    'initial' | 'email' | 'otp' | 'magic-link-sent'
  >('initial');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<
    'google' | 'github' | null
  >(null);
  const [lastUsed, setLastUsed] = useState<LastUsedMethod | null>(null);
  const [ctaVisible, setCtaVisible] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const otpSubmittedRef = useRef(false);
  const {
    token: captchaToken,
    containerRef: captchaRef,
    reset: resetCaptcha,
    detach: detachCaptcha,
    remount: remountCaptcha
  } = useCaptcha();

  useEffect(() => {
    setLastUsed(localStorage.getItem(LAST_METHOD_KEY) as LastUsedMethod | null);
    setCtaVisible(true);
  }, []);

  // The captcha container (<div ref={captchaRef} />) only exists in the
  // 'email' step's JSX -- it's absent for 'initial' (the toggle screen),
  // 'otp', and 'magic-link-sent' alike (both full early returns). The
  // provider's own mount effect fires once at AuthLayout-mount time, when
  // the container doesn't exist yet for a fresh page load (step starts at
  // 'initial'), so without this the widget never renders until this effect
  // does it explicitly. renderWidget tears down any existing widget first,
  // so re-running this on every transition into 'email' is safe.
  useEffect(() => {
    if (step === 'email') remountCaptcha();
  }, [step, remountCaptcha]);

  const markLastUsed = (authMethod: LastUsedMethod) => {
    localStorage.setItem(LAST_METHOD_KEY, authMethod);
    setLastUsed(authMethod);
  };

  const navigateAfterAuth = async () => {
    queryClient.removeQueries({ queryKey: bootstrapQueryKey() });
    await navigate({ to: destination, replace: true });
  };

  const captchaHeaders = captchaToken
    ? { 'x-captcha-response': captchaToken }
    : undefined;

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setError(null);
    setSocialLoading(provider);
    markLastUsed(provider);
    try {
      await authClient.signIn.social(
        { provider, callbackURL: destination },
        { headers: captchaHeaders }
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Social login failed'
      );
      setSocialLoading(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (turnstileEnabled && !captchaToken) {
      setError('Please complete the security challenge.');
      return;
    }
    setError(null);
    setIsLoading(true);
    markLastUsed('email');

    // Pre-submit validation (disposable + optional MX check): friendlier
    // inline error and skips a wasted send. The auth-server hooks in
    // src/server/auth.ts remain the security gate.
    if (config.auth.disposableEmailCheck || config.auth.mxCheck) {
      try {
        const validation = await validateEmail({ data: { email } });
        if (!validation.ok) {
          setError(validation.message);
          setIsLoading(false);
          return;
        }
      } catch (caught: unknown) {
        setError(
          caught instanceof Error ? caught.message : 'Failed to validate email'
        );
        setIsLoading(false);
        return;
      }
    }

    if (verificationMethod === 'magic-link') {
      try {
        const { error: mlError } = await authClient.signIn.magicLink(
          { email, callbackURL: destination },
          { headers: captchaHeaders }
        );
        if (mlError) {
          // Turnstile tokens are single-use: the failed request consumed it,
          // so a retry with the same token can only fail. Force a fresh one.
          resetCaptcha();
          setError(mlError.message ?? 'Failed to send magic link');
          setIsLoading(false);
          return;
        }
        // The captcha container unmounts once we leave this step -- tell
        // the provider before that happens instead of letting it
        // self-invalidate.
        detachCaptcha();
        setStep('magic-link-sent');
      } catch (caught: unknown) {
        resetCaptcha();
        setError(
          caught instanceof Error ? caught.message : 'Failed to send magic link'
        );
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const { error: otpError } = await authClient.emailOtp.sendVerificationOtp(
        { email, type: 'sign-in' },
        { headers: captchaHeaders }
      );
      if (otpError) {
        resetCaptcha();
        setError(otpError.message ?? 'Failed to send code');
        setIsLoading(false);
        return;
      }
      // The captcha container unmounts once we leave this step -- tell the
      // provider before that happens instead of letting it self-invalidate.
      detachCaptcha();
      setStep('otp');
    } catch (caught: unknown) {
      resetCaptcha();
      setError(
        caught instanceof Error ? caught.message : 'Failed to send verification'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (code: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const { error: verifyError } = await authClient.signIn.emailOtp({
        email,
        otp: code
      });
      if (verifyError) {
        setError(verifyError.message ?? 'Invalid code');
        setIsLoading(false);
        return;
      }
      await navigateAfterAuth();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Verification failed'
      );
      setIsLoading(false);
    }
  };

  const resetToInitial = () => {
    setStep('initial');
    setOtp('');
    setError(null);
    otpSubmittedRef.current = false;
    // The successful send consumed the captcha token; the next send needs a
    // fresh one.
    resetCaptcha();
  };

  useEffect(() => {
    if (step === 'otp' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  if (step === 'magic-link-sent') {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="space-y-1 text-center">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ letterSpacing: '-0.5px' }}
          >
            Check your email
          </h1>
          <p className="text-muted-foreground text-sm">
            We sent a sign-in link to <strong>{email}</strong>. Click it to
            continue.
          </p>
        </div>
        <button
          className="text-muted-foreground text-sm hover:underline"
          onClick={resetToInitial}
          type="button"
        >
          Use a different email
        </button>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="space-y-1 text-center">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ letterSpacing: '-0.5px' }}
          >
            Check your email
          </h1>
          <p className="text-muted-foreground text-sm">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
        </div>

        <div className="w-full space-y-3">
          <ErrorBanner message={error} />
          <input
            className="border-input bg-background placeholder:text-muted-foreground focus:shadow-[0_0_0_1px_hsl(var(--foreground)/0.4),0_0_0_4px_hsl(var(--foreground)/0.08)] h-12 w-full rounded-lg border px-3 text-center text-xl tracking-[0.4em] outline-none transition-shadow"
            disabled={isLoading}
            id="otp"
            inputMode="numeric"
            maxLength={6}
            onChange={e => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setOtp(val);
              if (val.length < 6) {
                otpSubmittedRef.current = false;
                setError(null);
              } else if (!otpSubmittedRef.current) {
                otpSubmittedRef.current = true;
                verifyOtp(val);
              }
            }}
            pattern="[0-9]*"
            placeholder="000000"
            ref={otpInputRef}
            type="text"
            value={otp}
          />
          {isLoading && (
            <p className="text-muted-foreground text-center text-sm">
              Verifying...
            </p>
          )}
        </div>

        <button
          className="text-muted-foreground text-sm hover:underline"
          onClick={resetToInitial}
          type="button"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <h1
        className="text-3xl font-bold tracking-tight"
        style={{ letterSpacing: '-0.5px' }}
      >
        Create your {appName} account
      </h1>

      <div className="w-full space-y-3">
        <ErrorBanner message={error} />

        {hasSocialProviders && (
          <>
            {googleEnabled && (
              <div className="relative">
                {lastUsed === 'google' && (
                  <span className="animate-in fade-in absolute -top-2 -right-2 z-10 inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-primary-foreground">
                    Last used
                  </span>
                )}
                <button
                  aria-label="Continue with Google"
                  className="border-input bg-card hover:bg-muted text-foreground flex h-12 w-full items-center justify-center gap-3 rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50"
                  disabled={isLoading || socialLoading !== null}
                  onClick={() => handleSocialLogin('google')}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0"
                    viewBox="0 0 16 16"
                  >
                    <path
                      d="M15.68 8.18c0-.63-.06-1.23-.16-1.81H8v3.42h4.34a3.71 3.71 0 0 1-1.61 2.44v2.03h2.61c1.52-1.4 2.4-3.47 2.4-6.08z"
                      fill="#4285F4"
                    />
                    <path
                      d="M8 16c2.16 0 3.97-.71 5.3-1.93l-2.61-2.03c-.72.48-1.63.77-2.69.77-2.07 0-3.82-1.4-4.45-3.27H.87v2.07C2.2 14.14 4.87 16 8 16z"
                      fill="#34A853"
                    />
                    <path
                      d="M3.55 9.54A4.82 4.82 0 0 1 3.3 8c0-.54.09-1.06.25-1.54V4.39H.87A8 8 0 0 0 0 8c0 1.29.31 2.5.87 3.61l2.68-2.07z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M8 3.18c1.18 0 2.24.41 3.07 1.2l2.3-2.3C11.96.79 10.16 0 8 0 4.87 0 2.2 1.86.87 4.39L3.55 6.46C4.18 4.59 5.93 3.18 8 3.18z"
                      fill="#EA4335"
                    />
                  </svg>
                  {socialLoading === 'google'
                    ? 'Redirecting...'
                    : 'Continue with Google'}
                </button>
              </div>
            )}

            {githubEnabled && (
              <div className="relative">
                {lastUsed === 'github' && (
                  <span className="animate-in fade-in absolute -top-2 -right-2 z-10 inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-primary-foreground">
                    Last used
                  </span>
                )}
                <button
                  aria-label="Continue with GitHub"
                  className="border-input bg-card hover:bg-muted text-foreground flex h-12 w-full items-center justify-center gap-3 rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50"
                  disabled={isLoading || socialLoading !== null}
                  onClick={() => handleSocialLogin('github')}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  {socialLoading === 'github'
                    ? 'Redirecting...'
                    : 'Continue with GitHub'}
                </button>
              </div>
            )}

            <div className="border-border border-t" role="presentation" />
          </>
        )}

        {step === 'email' ? (
          <form className="space-y-2" onSubmit={handleEmailSubmit}>
            <input
              aria-label="Email Address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              // biome-ignore lint/a11y/noAutofocus: user explicitly clicked "Continue with Email"
              autoFocus
              className="border-input bg-background placeholder:text-muted-foreground focus:shadow-[0_0_0_1px_hsl(var(--foreground)/0.4),0_0_0_4px_hsl(var(--foreground)/0.08)] h-12 w-full rounded-lg border px-3 text-sm outline-none transition-shadow"
              disabled={isLoading || socialLoading !== null}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email Address"
              required
              spellCheck={false}
              type="email"
              value={email}
            />
            <div ref={captchaRef} />
            <button
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-12 w-full items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50"
              disabled={
                isLoading ||
                socialLoading !== null ||
                !email ||
                (turnstileEnabled && !captchaToken)
              }
              type="submit"
            >
              {isLoading ? 'Sending...' : 'Continue with Email'}
            </button>
          </form>
        ) : (
          <button
            className="text-foreground w-full text-center text-sm font-medium hover:underline"
            onClick={() => setStep('email')}
            type="button"
          >
            Continue with Email →
          </button>
        )}
      </div>

      <p className="text-muted-foreground text-center text-xs">
        By signing up, you agree to our{' '}
        <Link className="underline underline-offset-4" to="/tos">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link className="underline underline-offset-4" to="/privacy">
          Privacy Policy
        </Link>
        .
      </p>

      <div
        style={{
          transition:
            'opacity 110ms ease-out, transform 175ms ease-in-out, filter 110ms ease-out',
          opacity: ctaVisible ? 1 : 0,
          transform: ctaVisible ? 'translateY(0px)' : 'translateY(8px)',
          filter: ctaVisible ? 'blur(0px)' : 'blur(4px)'
        }}
      >
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{' '}
          <Link className="text-foreground hover:underline" to="/login">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
