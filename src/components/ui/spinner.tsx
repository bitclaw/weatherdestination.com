import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/cn';

const spinnerVariants = cva('', {
  variants: {
    size: {
      xs: 'h-3 w-3',
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
      xl: 'h-12 w-12'
    },
    variant: {
      default: 'text-muted-foreground',
      primary: 'text-primary',
      white: 'text-white',
      destructive: 'text-destructive'
    },
    speed: {
      slow: '[animation-duration:2s]',
      normal: '[animation-duration:1s]',
      fast: '[animation-duration:0.5s]'
    }
  },
  defaultVariants: {
    size: 'sm',
    variant: 'default',
    speed: 'normal'
  }
});

export type SpinnerProps = Omit<
  React.SVGProps<SVGSVGElement>,
  'size' | 'speed'
> &
  VariantProps<typeof spinnerVariants> & {
    type?: 'circle' | 'dots';
    className?: string;
  };

export function Spinner({
  className,
  size,
  variant,
  speed,
  type = 'circle',
  ref,
  ...props
}: SpinnerProps) {
  const baseClasses = spinnerVariants({ size, variant, speed });

  if (type === 'dots') {
    return (
      <svg
        aria-hidden="true"
        className={baseClasses}
        fill="currentColor"
        ref={ref}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <circle cx="4" cy="12" r="3">
          <animate
            attributeName="opacity"
            begin="0s"
            dur="1s"
            repeatCount="indefinite"
            values="0;1;0"
          />
        </circle>
        <circle cx="12" cy="12" r="3">
          <animate
            attributeName="opacity"
            begin="0.2s"
            dur="1s"
            repeatCount="indefinite"
            values="0;1;0"
          />
        </circle>
        <circle cx="20" cy="12" r="3">
          <animate
            attributeName="opacity"
            begin="0.4s"
            dur="1s"
            repeatCount="indefinite"
            values="0;1;0"
          />
        </circle>
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={cn(baseClasses, 'animate-spin', className)}
      fill="none"
      ref={ref}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        fill="currentColor"
      />
    </svg>
  );
}

export { spinnerVariants };
