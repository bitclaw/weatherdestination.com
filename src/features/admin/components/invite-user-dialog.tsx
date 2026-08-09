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
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { adminInviteUserFn } from '@/features/admin';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InviteUserDialog({ open, onOpenChange }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setEmail('');
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await adminInviteUserFn({ data: { email } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      onOpenChange={isOpen => {
        // Ignore close attempts while an invite request is in flight - see
        // the equivalent guard in add-user-dialog.tsx.
        if (!isOpen && pending) return;
        if (!isOpen) reset();
        onOpenChange(isOpen);
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send a sign-in link to invite someone to the app.
          </DialogDescription>
        </DialogHeader>
        {success ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invite link sent to <strong>{email}</strong>.
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} variant="outline">
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FormField htmlFor="invite-email" label="Email">
              <Input
                id="invite-email"
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
                type="email"
                value={email}
              />
            </FormField>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button disabled={pending} type="submit">
                {pending ? 'Sending...' : 'Send Invite'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
