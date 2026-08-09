import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  XCircle
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type StatusBannerVariant = 'success' | 'info' | 'neutral' | 'warning' | 'error';

const VARIANT_STYLES: Record<StatusBannerVariant, string> = {
  success:
    'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  neutral:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
  warning:
    'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
  error: 'border-destructive/30 bg-destructive/10 text-destructive'
};

const VARIANT_ICONS: Record<StatusBannerVariant, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  info: <Loader2 className="h-4 w-4 shrink-0 animate-spin" />,
  neutral: <Info className="h-4 w-4 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
  error: <XCircle className="h-4 w-4 shrink-0" />
};

type StatusBannerProps = {
  variant: StatusBannerVariant;
  children: ReactNode;
  /** Pass null to omit the icon entirely; omit the prop for the variant default. */
  icon?: ReactNode | null;
  className?: string;
};

export const StatusBanner = ({
  variant,
  children,
  icon,
  className
}: StatusBannerProps) => (
  <div
    className={cn(
      'flex items-center gap-3 rounded-lg border p-4 text-sm',
      VARIANT_STYLES[variant],
      className
    )}
    role="alert"
  >
    {icon === undefined ? VARIANT_ICONS[variant] : icon}
    {children}
  </div>
);
