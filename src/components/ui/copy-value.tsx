import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './tooltip';

type CopyValueProps = {
  value: string;
  children: ReactNode;
  className?: string;
};

export function CopyValue({ value, children, className }: CopyValueProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn('cursor-pointer', className)}
            onClick={handleCopy}
            type="button"
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Copied!' : 'Click to copy'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
