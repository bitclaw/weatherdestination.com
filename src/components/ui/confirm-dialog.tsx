import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from './button';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  checkboxLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  checkboxLabel,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const [checked, setChecked] = useState(false);
  // Guards against a double-click/double-Enter firing onConfirm twice before
  // the dialog closes - some consumers pass an async onConfirm directly and
  // don't close the dialog (or clear its target state) until that async
  // work finishes, leaving the confirm button clickable throughout.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setChecked(false);
      setConfirming(false);
    }
  }, [open]);

  const canConfirm = !checkboxLabel || checked;

  const handleConfirm = () => {
    if (!canConfirm || confirming) return;
    setConfirming(true);
    onConfirm();
  };

  return (
    <DialogPrimitive.Root
      onOpenChange={isOpen => {
        if (!isOpen) onCancel();
      }}
      open={open}
    >
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 bg-black/50"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content
              asChild
              onOpenAutoFocus={e => {
                e.preventDefault();
              }}
            >
              <motion.div
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                className="bg-background text-foreground fixed inset-0 z-50 m-auto h-fit max-w-md rounded-lg border p-0 shadow-lg"
                exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
              >
                <div className="p-6">
                  <DialogPrimitive.Title className="text-lg font-semibold">
                    {title}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-muted-foreground mt-2 text-sm">
                    {description}
                  </DialogPrimitive.Description>
                  {checkboxLabel && (
                    <label className="mt-4 flex cursor-pointer items-start gap-2">
                      <input
                        checked={checked}
                        className="mt-0.5 h-4 w-4 shrink-0"
                        onChange={e => setChecked(e.target.checked)}
                        type="checkbox"
                      />
                      <span className="text-sm">{checkboxLabel}</span>
                    </label>
                  )}
                  <div className="mt-6 flex justify-end gap-2">
                    <Button
                      className="h-auto px-4 py-2"
                      disabled={confirming}
                      onClick={onCancel}
                      size="default"
                      type="button"
                      variant="outline"
                    >
                      {cancelLabel}
                    </Button>
                    <Button
                      autoFocus
                      className={
                        variant === 'destructive'
                          ? 'h-auto bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90'
                          : 'h-auto px-4 py-2'
                      }
                      disabled={!canConfirm || confirming}
                      onClick={handleConfirm}
                      size="default"
                      type="button"
                    >
                      {confirmLabel}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'destructive' | 'default';
  checkboxLabel?: string;
};

type ConfirmState = ConfirmOptions & { open: boolean };

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: ''
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setState({ ...options, open: true });
    });
  };

  const handleConfirm = () => {
    setState(prev => ({ ...prev, open: false }));
    resolveRef.current?.(true);
    resolveRef.current = null;
  };

  const handleCancel = () => {
    setState(prev => ({ ...prev, open: false }));
    resolveRef.current?.(false);
    resolveRef.current = null;
  };

  const dialogProps = {
    open: state.open,
    title: state.title,
    description: state.description,
    confirmLabel: state.confirmLabel,
    variant: state.variant,
    checkboxLabel: state.checkboxLabel,
    onConfirm: handleConfirm,
    onCancel: handleCancel
  };

  return { confirm, dialogProps };
}
