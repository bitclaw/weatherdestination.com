import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useConfirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { authClient } from '@/lib/auth-client';
import { TwoFactorBackupCodesDialog } from './two-factor-backup-codes-dialog';
import { TwoFactorEnrollDialog } from './two-factor-enroll-dialog';

type Props = {
  enabled: boolean;
  onRefetch: () => undefined | Promise<unknown>;
};

// Vercel-style "Two-Factor Authentication" block (Active/Inactive status,
// not a bare toggle) - structured as a single-method section for now
// (TOTP only) so a future second method can sit alongside it as a sibling
// without a redesign. Takes enabled/onRefetch from the parent rather than
// calling authClient.useSession() itself - AccountPage already holds that
// hook's result for the active-sessions list, and a second independent
// call here would duplicate the session fetch.
export function TwoFactorSection({ enabled, onRefetch }: Props) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [backupCodesOpen, setBackupCodesOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  const handleEnrolled = () => {
    onRefetch();
    toast.success('Two-factor authentication enabled.');
  };

  const handleDisable = async () => {
    const confirmed = await confirm({
      title: 'Disable two-factor authentication',
      description:
        'Your account will only require your usual sign-in method. Backup codes will stop working.',
      confirmLabel: 'Disable 2FA',
      variant: 'destructive'
    });
    if (!confirmed) return;

    setDisabling(true);
    try {
      const { error } = await authClient.twoFactor.disable({});
      if (error) {
        toast.error(error.message ?? 'Failed to disable 2FA');
        return;
      }
      await onRefetch();
      toast.success('Two-factor authentication disabled.');
    } finally {
      setDisabling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium">Two-factor authentication</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add a second step when signing in.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border px-4 py-3">
        <div className="flex items-center gap-3">
          <ShieldCheck
            className={
              enabled ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-muted-foreground'
            }
          />
          <div>
            <p className="text-sm font-medium">Authenticator app (TOTP)</p>
            <p className="text-xs text-muted-foreground">
              Use an app like 1Password, Google Authenticator, or Microsoft
              Authenticator.
            </p>
          </div>
        </div>
        <Badge variant={enabled ? 'default' : 'outline'}>
          {enabled ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {enabled ? (
          <>
            <Button
              onClick={() => setBackupCodesOpen(true)}
              type="button"
              variant="outline"
            >
              Regenerate backup codes
            </Button>
            <Button
              disabled={disabling}
              onClick={handleDisable}
              type="button"
              variant="destructive"
            >
              {disabling ? 'Disabling...' : 'Disable'}
            </Button>
          </>
        ) : (
          <Button onClick={() => setEnrollOpen(true)} type="button">
            Enable
          </Button>
        )}
      </div>

      <TwoFactorEnrollDialog
        onEnrolled={handleEnrolled}
        onOpenChange={setEnrollOpen}
        open={enrollOpen}
      />
      <TwoFactorBackupCodesDialog
        onOpenChange={setBackupCodesOpen}
        open={backupCodesOpen}
      />
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
