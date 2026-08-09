import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  createCheckoutSessionFn,
  createOneTimeCheckoutFn
} from '@/features/billing';
import { ERROR_CODES, PATHS } from '@/lib/constants';
import { cn } from '@/lib/utils';

type CheckoutButtonProps = {
  priceId: string;
  interval: 'monthly' | 'yearly';
  mode?: 'subscription' | 'one_time';
  children?: React.ReactNode;
  className?: string;
};

export function CheckoutButton({
  priceId,
  interval,
  mode = 'subscription',
  children = 'Get started',
  className
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleClick = async () => {
    setLoading(true);
    try {
      const result =
        mode === 'one_time'
          ? await createOneTimeCheckoutFn({ data: { priceId } })
          : await createCheckoutSessionFn({ data: { priceId, interval } });

      if (!result.ok) {
        if (result.code === ERROR_CODES.UNAUTHORIZED) {
          // Preserve the checkout intent across the forced login - without
          // this, login's default post-login redirect (PATHS.DASHBOARD)
          // silently drops the purchase and the visitor never sees Stripe.
          const resumePath = `/checkout/resume?priceId=${encodeURIComponent(priceId)}&mode=${mode}&interval=${interval}`;
          await navigate({
            to: PATHS.LOGIN,
            search: { redirect: resumePath }
          });
          return;
        }
        return;
      }
      window.location.href = result.data.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      className={cn('h-auto px-4 py-2.5', className)}
      disabled={loading}
      onClick={handleClick}
      type="button"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
