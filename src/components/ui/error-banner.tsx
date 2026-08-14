import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

const variantStyles = {
  error: 'border-destructive/50 bg-destructive/10 text-destructive',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning'
} as const;

const dismissStyles = {
  error: 'text-destructive/70 hover:text-destructive',
  success: 'text-success/70 hover:text-success',
  warning: 'text-warning/70 hover:text-warning'
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
