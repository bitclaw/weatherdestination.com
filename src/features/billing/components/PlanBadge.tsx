import type { PlanId } from '@/config';
import { cn } from '@/lib/cn';

type PlanBadgeProps = {
  plan: 'free' | PlanId;
  isTrialing?: boolean;
  className?: string;
};

export function PlanBadge({ plan, isTrialing, className }: PlanBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        plan !== 'free'
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {plan}
      {isTrialing && ' (trial)'}
    </span>
  );
}
