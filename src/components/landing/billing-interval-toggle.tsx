import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type BillingIntervalToggleProps = {
  isYearly: boolean;
  onChange: (isYearly: boolean) => void;
};

const options = [
  { label: 'Monthly', value: false },
  { label: 'Yearly', value: true }
] as const;

export function BillingIntervalToggle({
  isYearly,
  onChange
}: BillingIntervalToggleProps) {
  return (
    <div className="relative flex items-center justify-center">
      <div className="bg-muted relative inline-flex rounded-full p-1">
        {options.map(option => (
          <Button
            className={cn(
              'relative z-10 h-auto rounded-full px-4 py-1.5',
              isYearly === option.value
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            key={option.label}
            onClick={() => onChange(option.value)}
            type="button"
            variant="ghost"
          >
            {isYearly === option.value && (
              <motion.span
                className="bg-primary absolute inset-0 rounded-full"
                layoutId="billing-interval-pill"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </Button>
        ))}
      </div>
      {isYearly && (
        <motion.span
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary/10 text-primary absolute left-[calc(50%+5.5rem)] rounded-full px-2.5 py-0.5 text-xs font-semibold"
          initial={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
        >
          Save ~17%
        </motion.span>
      )}
    </div>
  );
}
