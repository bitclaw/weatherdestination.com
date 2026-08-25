import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { ErrorBanner } from '@/components/ui/error-banner';
import { authClient } from '@/lib/auth-client';
import { PATHS } from '@/lib/constants';
import { bootstrapQueryKey } from '@/lib/query-keys';
import { Route } from '@/routes/_auth.two-factor';

// Landing point for auth.ts's hooks.after bridge (Branch A/B/C - see
// bridgeTwoFactorChallenge in src/server/auth.ts). By the time this page
// renders, the user has no valid session - only the pending `two_factor`
// cookie the bridge wrote. Submitting a code here calls better-auth's own
// /two-factor/verify-totp or /two-factor/verify-backup-code, which reads
// that cookie directly; this page has no server-side involvement of its
// own beyond the redirect on success.
export function TwoFactorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { redirectTo } = Route.useSearch();
  const destination = redirectTo ?? PATHS.DASHBOARD;

  const [useBackupCode, setUseBackupCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const submittedRef = useRef(false);

  const navigateAfterVerify = async () => {
    queryClient.removeQueries({ queryKey: bootstrapQueryKey() });
    await navigate({ to: destination, replace: true });
  };

  const submitCode = async (value: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const { error: verifyError } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code: value })
        : await authClient.twoFactor.verifyTotp({ code: value });
      if (verifyError) {
        setError(verifyError.message ?? 'Invalid code');
        setIsLoading(false);
        submittedRef.current = false;
        return;
      }
      await navigateAfterVerify();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Verification failed'
      );
      setIsLoading(false);
      submittedRef.current = false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submittedRef.current) return;
    submittedRef.current = true;
    submitCode(code);
  };

  const toggleMethod = () => {
    setUseBackupCode(v => !v);
    setCode('');
    setError(null);
    submittedRef.current = false;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="space-y-1 text-center">
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ letterSpacing: '-0.5px' }}
        >
          Two-factor authentication
        </h1>
        <p className="text-muted-foreground text-sm">
          {useBackupCode
            ? 'Enter one of your backup codes.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>
      </div>

      <form className="w-full space-y-3" onSubmit={handleSubmit}>
        <ErrorBanner message={error} />
        {useBackupCode ? (
          <input
            className="border-input bg-background placeholder:text-muted-foreground focus:shadow-[0_0_0_1px_hsl(var(--foreground)/0.4),0_0_0_4px_hsl(var(--foreground)/0.08)] h-12 w-full rounded-lg border px-3 text-center font-mono text-sm outline-none transition-shadow"
            disabled={isLoading}
            id="backup-code"
            key="backup-code"
            onChange={e => setCode(e.target.value.trim())}
            placeholder="Backup code"
            ref={el => el?.focus()}
            type="text"
            value={code}
          />
        ) : (
          <input
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:shadow-[0_0_0_1px_hsl(var(--foreground)/0.4),0_0_0_4px_hsl(var(--foreground)/0.08)] h-12 w-full rounded-lg border px-3 text-center text-xl tracking-[0.4em] outline-none transition-shadow"
            disabled={isLoading}
            id="totp-code"
            inputMode="numeric"
            key="totp-code"
            maxLength={6}
            onChange={e => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setCode(val);
              if (val.length < 6) {
                submittedRef.current = false;
                setError(null);
              } else if (!submittedRef.current) {
                submittedRef.current = true;
                submitCode(val);
              }
            }}
            pattern="[0-9]*"
            placeholder="000000"
            ref={el => el?.focus()}
            type="text"
            value={code}
          />
        )}
        {isLoading && (
          <p className="text-muted-foreground text-center text-sm">
            Verifying...
          </p>
        )}
        {useBackupCode && (
          <button
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-12 w-full items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50"
            disabled={isLoading || !code}
            type="submit"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        )}
      </form>

      <button
        className="text-muted-foreground text-sm hover:underline"
        onClick={toggleMethod}
        type="button"
      >
        {useBackupCode
          ? 'Use your authenticator app instead'
          : 'Use a backup code instead'}
      </button>
    </div>
  );
}
