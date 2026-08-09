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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { adminCreateUserFn } from '@/features/admin';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function AddUserDialog({ open, onOpenChange, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setName('');
    setEmail('');
    setRole('user');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await adminCreateUserFn({ data: { name, email, role } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      onOpenChange={isOpen => {
        // Ignore close attempts while a create request is in flight -
        // closing early would skip onSuccess() for a user that's about to
        // exist, and let the response's reset()/onSuccess() land on a dialog
        // already reopened for a different entry.
        if (!isOpen && pending) return;
        if (!isOpen) reset();
        onOpenChange(isOpen);
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>
            Create a new user account. They will sign in via email.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField htmlFor="add-name" label="Name">
            <Input
              id="add-name"
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              value={name}
            />
          </FormField>
          <FormField htmlFor="add-email" label="Email">
            <Input
              id="add-email"
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
              type="email"
              value={email}
            />
          </FormField>
          <FormField htmlFor="add-role" label="Role">
            <Select
              onValueChange={v => setRole(v as 'user' | 'admin')}
              value={role}
            >
              <SelectTrigger id="add-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
