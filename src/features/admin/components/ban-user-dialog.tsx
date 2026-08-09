import { useEffect, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { AdminUser } from '@/features/admin';
import { adminBanUserFn, adminUnbanUserFn } from '@/features/admin';

const EXPIRES_OPTIONS = [
  { label: '1 day', value: String(60 * 60 * 24) },
  { label: '7 days', value: String(60 * 60 * 24 * 7) },
  { label: '30 days', value: String(60 * 60 * 24 * 30) },
  { label: 'Never', value: 'never' }
];

type Props = {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function BanUserDialog({ user, open, onOpenChange, onSuccess }: Props) {
  const [banReason, setBanReason] = useState('');
  const [expiresIn, setExpiresIn] = useState('never');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setBanReason('');
      setExpiresIn('never');
      setError(null);
      setPending(false);
    }
  }, [open]);

  // This dialog instance is reused across every row in the users table (no
  // per-user remount) - closing while a ban/unban request is in flight for
  // user A must not leave `pending` stuck true when the dialog reopens for
  // user B, and a stale request resolving after close must not fire
  // onSuccess()/close against whichever user is now open. Guarding the close
  // itself is simplest: ignore close attempts while pending.
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && pending) return;
    onOpenChange(isOpen);
  };

  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setPending(true);
    try {
      const res = await adminBanUserFn({
        data: {
          userId: user.id,
          banReason: banReason || undefined,
          banExpiresIn: expiresIn !== 'never' ? Number(expiresIn) : undefined
        }
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to ban user');
    } finally {
      setPending(false);
    }
  };

  const handleUnban = async () => {
    if (!user) return;
    setError(null);
    setPending(true);
    try {
      const res = await adminUnbanUserFn({ data: { userId: user.id } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unban user');
    } finally {
      setPending(false);
    }
  };

  if (!user) return null;

  if (user.banned) {
    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Unban {user.name}</DialogTitle>
            <DialogDescription>
              {user.banReason
                ? `Banned for: ${user.banReason}`
                : 'This user is currently banned.'}{' '}
              Remove the ban to restore access.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button disabled={pending} onClick={handleUnban} type="button">
              {pending ? 'Unbanning...' : 'Unban User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ban {user.name}</DialogTitle>
          <DialogDescription>
            Prevent this user from signing in. You can unban them later.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleBan}>
          <FormField htmlFor="ban-reason" label="Reason" optional>
            <Input
              id="ban-reason"
              onChange={e => setBanReason(e.target.value)}
              placeholder="Spamming, abuse, etc."
              value={banReason}
            />
          </FormField>
          <FormField htmlFor="ban-expires" label="Expires">
            <Select onValueChange={setExpiresIn} value={expiresIn}>
              <SelectTrigger id="ban-expires">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRES_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              className="bg-destructive hover:bg-destructive/90"
              disabled={pending}
              type="submit"
            >
              {pending ? 'Banning...' : 'Ban User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
