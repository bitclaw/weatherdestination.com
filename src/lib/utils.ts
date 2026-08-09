import { type ClassValue, clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/**
 * Format a timestamp (ms since epoch) as a human-readable relative string.
 * Uses date-fns under the hood. Prefer this over inline `Date.now() - ts` math.
 */
export const relativeTime = (ts: number): string =>
  formatDistanceToNow(new Date(ts), { addSuffix: true });

export const getPageNumbers = (
  currentPage: number,
  totalPages: number
): (number | '...')[] => {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
  if (currentPage >= totalPages - 3)
    return [
      1,
      '...',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages
    ];
  return [
    1,
    '...',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    '...',
    totalPages
  ];
};
