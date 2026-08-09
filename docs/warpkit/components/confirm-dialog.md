# ConfirmDialog

An animated confirmation dialog with optional destructive variant and optional checkbox requirement. Used for irreversible actions (delete account, revoke API key, etc.).

Exported from `src/components/ui` as `ConfirmDialog` and `useConfirm`.

## useConfirm hook (recommended)

`useConfirm` returns a `confirm()` function that resolves to `true` (confirmed) or `false` (cancelled). Render `<ConfirmDialog {...dialogProps} />` alongside your component.

```tsx
import { ConfirmDialog, useConfirm } from '@/components/ui';

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const { confirm, dialogProps } = useConfirm();

  const handleClick = async () => {
    const ok = await confirm({
      title: 'Delete item?',
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive'
    });
    if (ok) onDelete();
  };

  return (
    <>
      <button type="button" onClick={handleClick}>Delete</button>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
```

## With checkbox requirement

Pass `checkboxLabel` to require the user to check a box before the confirm button activates. Used for high-stakes actions like account deletion:

```tsx
const ok = await confirm({
  title: 'Delete your account?',
  description: 'All your data will be permanently deleted.',
  confirmLabel: 'Delete account',
  checkboxLabel: 'I understand this cannot be undone',
  variant: 'destructive'
});
```

## Props (ConfirmDialog)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | , | Dialog visibility |
| `title` | `string` | , | Dialog heading |
| `description` | `string` | , | Body text |
| `confirmLabel` | `string` | `'Confirm'` | Confirm button text |
| `cancelLabel` | `string` | `'Cancel'` | Cancel button text |
| `variant` | `'destructive' \| 'default'` | `'destructive'` | Confirm button style |
| `checkboxLabel` | `string` | , | If set, requires checkbox before confirm activates |
| `onConfirm` | `() => void` | , | Called on confirm |
| `onCancel` | `() => void` | , | Called on cancel or close |
