import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

// success/warning use raw Tailwind colors with manual dark: overrides, not a
// CSS token, because there is no --success/--warning token anywhere in
// styles.css , only destructive is a first-class semantic color here. This
// matches badge.tsx/toast.tsx's identical pattern; fixing only this file
// would make it inconsistent with its own siblings, not less hardcoded.
const variantStyles = {
  error: 'border-destructive/50 bg-destructive/10 text-destructive',
  success:
    'border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-200',
  warning:
    'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'
} as const;

const dismissStyles = {
  error: 'text-destructive/70 hover:text-destructive',
  success:
    'text-green-600/70 hover:text-green-800 dark:text-green-300/70 dark:hover:text-green-200',
  warning:
    'text-yellow-600/70 hover:text-yellow-800 dark:text-yellow-300/70 dark:hover:text-yellow-200'
} as const;

type BannerProps = {
  message: string | null;
  className?: string;
  onDismiss?: () => void;
  variant?: 'error' | 'success' | 'warning';
};

export function ErrorBanner({
  message,
  className,
  onDismiss,
  variant = 'error'
}: BannerProps) {
  if (!message) return null;

  return (
    <div
      aria-live="assertive"
      className={cn(
        'flex items-center justify-between rounded-lg border p-3 text-sm',
        variantStyles[variant],
        className
      )}
      role="alert"
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          className={cn('ml-3 shrink-0', dismissStyles[variant])}
          onClick={onDismiss}
          type="button"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      )}
    </div>
  );
}
