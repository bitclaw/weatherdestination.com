import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: () => void;
};

type Phase = 'qr' | 'backup-codes';

// Enrollment flow: open the dialog -> immediately call enable() (no
// password, this app is passwordless throughout) -> show the QR + manual
// secret + a 6-digit confirmation input -> on a correct code, show the
// backup codes returned by enable() (already have them, no separate call
// needed) exactly once. Two-phase, adapted because phase one here has its
// own async setup step instead of a form submit.
export function TwoFactorEnrollDialog({
  open,
  onOpenChange,
  onEnrolled
}: Props) {
  const [phase, setPhase] = useState<Phase>('qr');
  const [totpURI, setTotpURI] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  const startEnrollment = async () => {
    setPending(true);
    setError('');
    try {
      const { data, error: enableError } = await authClient.twoFactor.enable({
        method: 'totp'
      });
      // method: 'totp' was requested above, but the response type is a
      // discriminated union over the *request's* method field
      // ({method:'otp'} | {method:'totp', totpURI, backupCodes}) - TS can't
      // narrow it from the call site, so narrow explicitly on the response.
      if (enableError || !data || data.method !== 'totp') {
        setError(enableError?.message ?? 'Failed to start enrollment');
        return;
      }
      setTotpURI(data.totpURI);
      const secretParam = new URL(data.totpURI).searchParams.get('secret');
      setSecret(secretParam ?? '');
      setBackupCodes(data.backupCodes);
    } finally {
      setPending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      const { error: verifyError } = await authClient.twoFactor.verifyTotp({
        code
      });
      if (verifyError) {
        setError(verifyError.message ?? 'Invalid code');
        return;
      }
      setPhase('backup-codes');
    } finally {
      setPending(false);
    }
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (pending) return;
    onOpenChange(false);
    if (phase === 'backup-codes') onEnrolled();
    setTimeout(() => {
      setPhase('qr');
      setTotpURI('');
      setSecret('');
      setBackupCodes([]);
      setCode('');
      setError('');
      setCopied(false);
      startedRef.current = false;
    }, 200);
  };

  // Kick off enrollment once per open transition - Dialog stays mounted
  // while closed (Radix keeps it in the tree for exit animations), and a
  // ref (not state) guards against Strict Mode's double-invoke calling
  // enable() twice for the same open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: startEnrollment is stable in intent (no external deps that should re-trigger it); adding it to deps would refire enrollment every render, since it's redefined each render
  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    startEnrollment();
  }, [open]);

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent className="sm:max-w-md">
        {phase === 'qr' ? (
          <form onSubmit={handleVerify}>
            <DialogHeader>
              <DialogTitle>Set up authenticator app</DialogTitle>
              <DialogDescription>
                Scan the QR code with an app like 1Password, Google
                Authenticator, or Microsoft Authenticator.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {totpURI ? (
                <>
                  <div className="flex justify-center rounded-md border bg-muted p-4">
                    <QRCodeSVG size={180} value={totpURI} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Can't scan it? Enter this code manually:
                    </p>
                    <p className="break-all rounded-md border bg-muted p-2 font-mono text-xs select-all">
                      {secret}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Input
                      autoFocus
                      id="totp-code"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={e =>
                        setCode(e.target.value.replace(/[^0-9]/g, ''))
                      }
                      placeholder="6-digit code"
                      value={code}
                    />
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {error || 'Setting up...'}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={handleClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={code.length !== 6 || pending} type="submit">
                {pending ? 'Verifying...' : 'Verify'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Save your backup codes</DialogTitle>
              <DialogDescription>
                These codes will not be shown again. Store them somewhere safe -
                each one can be used once if you lose access to your
                authenticator app.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-3 font-mono text-sm select-all">
                {backupCodes.map(bc => (
                  <span key={bc}>{bc}</span>
                ))}
              </div>
              <Button
                className="w-full"
                onClick={handleCopyCodes}
                variant="outline"
              >
                {copied ? 'Copied!' : 'Copy all codes'}
              </Button>
            </div>
            <DialogFooter>
              <Button className="w-full" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
