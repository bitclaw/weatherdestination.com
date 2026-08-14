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
  success: 'border-success/30 bg-success/10 text-success',
  info: 'border-info/30 bg-info/10 text-info',
  neutral: 'border-warning/30 bg-warning/10 text-warning',
  warning: 'border-warning/30 bg-warning/10 text-warning',
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
