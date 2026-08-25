import { useSuspenseQuery } from '@tanstack/react-query';
import { Monitor, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useConfirm } from '@/components/ui/confirm-dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import {
  accountSessionsQueryOptions,
  deleteMyAccountFn,
  exportMyDataFn,
  TwoFactorSection
} from '@/features/account';
import { authClient } from '@/lib/auth-client';
import type { AppUser } from '@/lib/types';
import { ContentSection } from './content-section';

type Props = { user: AppUser };

export function AccountPage({ user: _user }: Props) {
  const { data, refetch: refetchSessions } = useSuspenseQuery(
    accountSessionsQueryOptions
  );

  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMyDataFn();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete your account',
      description:
        'This permanently deletes all your data and cannot be undone.',
      confirmLabel: 'Delete my account',
      checkboxLabel: 'I understand this is permanent and irreversible',
      variant: 'destructive'
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const result = await deleteMyAccountFn({ data: {} });
      if (result.ok) {
        await authClient.signOut();
        window.location.href = '/';
      } else {
        toast.error(result.message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRevokeSession = async (token: string) => {
    setRevokingToken(token);
    try {
      await authClient.revokeSession({ token });
      await refetchSessions();
    } catch {
      // session may already be gone
    } finally {
      setRevokingToken(null);
    }
  };

  const handleRevokeOthers = async () => {
    setIsRevokingOthers(true);
    try {
      await authClient.revokeOtherSessions();
      await refetchSessions();
      toast.success('Signed out of all other devices.');
    } catch {
      toast.error('Failed to sign out other devices.');
    } finally {
      setIsRevokingOthers(false);
    }
  };

  const { data: currentSessionData, refetch: refetchSession } =
    authClient.useSession();
  const currentToken = currentSessionData?.session.token;
  const sessions = data.sessions;
  const needsFreshSession = data.needsFreshSession;

  return (
    <ContentSection
      desc="Manage active sessions and irreversible account actions."
      title="Account"
    >
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Active sessions</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Devices signed in to your account.
              </p>
            </div>
            {sessions.length > 1 && (
              <Button
                disabled={isRevokingOthers}
                onClick={handleRevokeOthers}
                size="sm"
                type="button"
                variant="outline"
              >
                {isRevokingOthers ? 'Signing out…' : 'Sign out other devices'}
              </Button>
            )}
          </div>

          {needsFreshSession ? (
            <p className="text-muted-foreground text-sm">
              For security, sign in again to view and manage your active
              sessions.
            </p>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sessions found.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {sessions.map(s => {
                const isCurrent = s.token === currentToken;
                const ua = s.userAgent ?? '';
                const isMobile = /mobile|android|iphone|ipad/i.test(ua);
                return (
                  <li
                    className="flex items-center gap-3 px-4 py-3"
                    key={s.token}
                  >
                    <div className="text-muted-foreground shrink-0">
                      {isMobile ? (
                        <Smartphone className="h-4 w-4" />
                      ) : (
                        <Monitor className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ua || 'Unknown device'}
                        {isCurrent && (
                          <span className="ml-2 text-xs text-primary font-normal">
                            current
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs truncate">
                        Signed in {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!isCurrent && (
                      <button
                        className="text-muted-foreground hover:text-destructive text-xs transition-colors disabled:opacity-50 shrink-0"
                        disabled={revokingToken === s.token}
                        onClick={() => handleRevokeSession(s.token)}
                        type="button"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Separator />

        <TwoFactorSection
          enabled={currentSessionData?.user.twoFactorEnabled ?? false}
          onRefetch={refetchSession}
        />

        <Separator />

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-destructive">
              Danger zone
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Irreversible account actions.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              disabled={isExporting}
              onClick={handleExport}
              type="button"
              variant="outline"
            >
              {isExporting ? 'Exporting…' : 'Download my data'}
            </Button>
            <Button
              disabled={isDeleting}
              onClick={handleDelete}
              type="button"
              variant="destructive"
            >
              {isDeleting ? 'Deleting…' : 'Delete my account'}
            </Button>
          </div>
        </div>

        <ConfirmDialog {...dialogProps} />
      </div>
    </ContentSection>
  );
}
