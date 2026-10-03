import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { IconGithub, IconGitlab, IconGoogle } from '@/assets/brand-icons';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useConfirm } from '@/components/ui/confirm-dialog';
import { ErrorBanner } from '@/components/ui/error-banner';
import { config } from '@/config';
import { authClient } from '@/lib/auth-client';
import { linkedAccountsQueryKey } from '@/lib/query-keys';
import { relativeTime } from '@/lib/utils';

type SocialProvider = 'google' | 'github' | 'gitlab';

// Social logins linked to the user (better-auth `accounts` rows). CLIENT-ONLY,
// same rule as accountSessionsQueryOptions in ../index.ts: authClient can't
// run during SSR, so never prefetch this in a route loader.
export const linkedAccountsQueryOptions = queryOptions({
  queryKey: linkedAccountsQueryKey(),
  queryFn: async () => {
    const result = await authClient.listAccounts();
    if (result.error) throw new Error(result.error.message);
    return result.data ?? [];
  }
});

const PROVIDERS: Record<
  SocialProvider,
  { label: string; icon: React.FC<{ className?: string }> }
> = {
  google: { label: 'Google', icon: IconGoogle },
  github: { label: 'GitHub', icon: IconGithub },
  gitlab: { label: 'GitLab', icon: IconGitlab }
};

// Same set the login page offers: a provider without a login button isn't
// a sign-in method.
const ENABLED_PROVIDERS = (Object.keys(PROVIDERS) as SocialProvider[]).filter(
  p => config.auth.socialProviders[p]
);

type Props = { email: string };

// Vercel-style "Sign-in methods": email plus each login-capable social
// provider, connect/disconnect per row (the user's better-auth `accounts`
// rows).
export function SignInMethodsSection({ email }: Props) {
  const { data: accounts, refetch } = useSuspenseQuery(
    linkedAccountsQueryOptions
  );
  const [busyProvider, setBusyProvider] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialogProps } = useConfirm();

  const handleConnect = async (provider: SocialProvider) => {
    setError(null);
    setBusyProvider(provider);
    const result = await authClient.linkSocial({
      provider,
      callbackURL: `${window.location.origin}/dashboard/settings/account`
    });
    // Success navigates away to the provider; only errors land here.
    if (result?.error) {
      setError(result.error.message ?? `Failed to connect ${provider}`);
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async (provider: SocialProvider) => {
    const { label } = PROVIDERS[provider];
    const confirmed = await confirm({
      title: `Disconnect ${label}`,
      description: `You won't be able to sign in with ${label} until you connect it again.`,
      confirmLabel: 'Disconnect',
      variant: 'destructive'
    });
    if (!confirmed) return;

    setError(null);
    setBusyProvider(provider);
    try {
      // A provider can have more than one row (e.g. a pre-1.7 link plus a
      // re-link); remove them all.
      for (const account of accounts.filter(a => a.providerId === provider)) {
        const result = await authClient.unlinkAccount({
          accountId: account.id
        });
        if (result.error) {
          setError(
            result.error.code === 'SESSION_NOT_FRESH'
              ? 'For security, sign in again before disconnecting a sign-in method.'
              : (result.error.message ?? `Failed to disconnect ${label}`)
          );
          return;
        }
      }
    } finally {
      await refetch();
      setBusyProvider(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium">Sign-in methods</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ways you can sign in to your account.
        </p>
      </div>

      <ErrorBanner message={error} />

      <ul className="divide-y rounded-md border">
        <li className="flex items-center gap-3 px-4 py-3">
          <Mail className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Email</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </li>
        {ENABLED_PROVIDERS.map(provider => {
          const { label, icon: Icon } = PROVIDERS[provider];
          const linked = accounts
            .filter(a => a.providerId === provider)
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )[0];
          const busy = busyProvider === provider;
          let buttonLabel = linked ? 'Disconnect' : 'Connect';
          if (busy) buttonLabel = linked ? 'Disconnecting…' : 'Redirecting…';
          return (
            <li className="flex items-center gap-3 px-4 py-3" key={provider}>
              <Icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {linked
                    ? `Connected ${relativeTime(new Date(linked.createdAt).getTime())}`
                    : `Connect your ${label} account`}
                </p>
              </div>
              <Button
                disabled={busyProvider !== null}
                onClick={() =>
                  linked ? handleDisconnect(provider) : handleConnect(provider)
                }
                size="sm"
                type="button"
                variant="outline"
              >
                {buttonLabel}
              </Button>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
