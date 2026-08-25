import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { authClient } from '@/lib/auth-client';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Regenerating backup codes invalidates the previous set (better-auth's own
// generateBackupCodes behavior) - this dialog calls it once on open, shows
// the new codes exactly once, same reveal pattern as the enroll dialog's
// second phase.
export function TwoFactorBackupCodesDialog({ open, onOpenChange }: Props) {
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setPending(true);
    setError('');
    try {
      const { data, error: genError } =
        await authClient.twoFactor.generateBackupCodes({});
      if (genError || !data) {
        setError(genError?.message ?? 'Failed to generate backup codes');
        return;
      }
      setCodes(data.backupCodes);
    } finally {
      setPending(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (pending) return;
    onOpenChange(false);
    setTimeout(() => {
      setCodes([]);
      setError('');
      setCopied(false);
    }, 200);
  };

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent className="sm:max-w-md">
        {codes.length === 0 ? (
          <>
            <DialogHeader>
              <DialogTitle>Regenerate backup codes</DialogTitle>
              <DialogDescription>
                This invalidates your existing backup codes. Anyone with the old
                codes will no longer be able to use them.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={handleClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={pending} onClick={handleGenerate}>
                {pending ? 'Generating...' : 'Generate new codes'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Your new backup codes</DialogTitle>
              <DialogDescription>
                These codes will not be shown again. Store them somewhere safe.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-3 font-mono text-sm select-all">
                {codes.map(c => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <Button className="w-full" onClick={handleCopy} variant="outline">
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
