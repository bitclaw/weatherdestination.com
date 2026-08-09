import { Copy, KeyRound } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createApiKeyFn } from '@/features/api-keys';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function ApiKeyCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [phase, setPhase] = useState<'form' | 'reveal'>('form');
  const [name, setName] = useState('');
  const [rawKey, setRawKey] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const result = await createApiKeyFn({ data: { name: name.trim() } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRawKey(result.data.rawKey);
      setPhase('reveal');
    } finally {
      setPending(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    // Ignore close attempts (Cancel, Escape, overlay click) while the create
    // request is in flight - closing early would skip onCreated() for a key
    // that's about to exist, and let the response's setRawKey/setPhase land
    // on a dialog that's already reset for the next open.
    if (pending) return;
    onOpenChange(false);
    if (phase === 'reveal') onCreated();
    setTimeout(() => {
      setPhase('form');
      setName('');
      setRawKey('');
      setError('');
      setCopied(false);
    }, 200);
  };

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent className="sm:max-w-md">
        {phase === 'form' ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Give your key a name so you remember what it's for.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  autoFocus
                  id="key-name"
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Production server"
                  value={name}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
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
              <Button disabled={!name.trim() || pending} type="submit">
                {pending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Save your API key
              </DialogTitle>
              <DialogDescription>
                This key will not be shown again. Copy it now.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="rounded-md border bg-muted p-3">
                <p className="break-all font-mono text-sm select-all">
                  {rawKey}
                </p>
              </div>
              <Button className="w-full" onClick={handleCopy} variant="outline">
                <Copy className="mr-2 h-4 w-4" />
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Store it somewhere safe , you won't be able to see it again.
              </p>
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
