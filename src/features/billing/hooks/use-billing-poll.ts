import type { QueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { bootstrapQueryKey, subscriptionQueryKey } from '@/lib/query-keys';

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 30_000;

export function isBillingSettled(
  targetPlan: string | null | undefined,
  currentPlan: string
): boolean {
  if (targetPlan) return currentPlan === targetPlan;
  return currentPlan !== 'free';
}

export function hasPollTimedOut(startMs: number, nowMs: number): boolean {
  return nowMs - startMs >= POLL_TIMEOUT_MS;
}

/**
 * Polls every 3s after a successful checkout until billing settles or 30s
 * elapses. Each tick invalidates BOTH the subscription query and the bootstrap
 * query, and re-runs route loaders: the visible plan/hasAccess flow through
 * bootstrap into route context, so invalidating the subscription key alone
 * never updates what the user sees.
 *
 * `isSettled` must be derived from live query data (not route context, which
 * is frozen for the mount) or the poll can never observe settlement.
 *
 * `onPollTick`, if provided, runs before the invalidations on each tick -
 * use it to actively reconcile against Stripe (e.g. syncCheckoutSessionFn)
 * instead of passively waiting for the webhook, so a delayed webhook
 * delivery doesn't leave the page stuck past the 30s timeout.
 *
 * Usage:
 *   useBillingPoll({ success, isSettled, queryClient });
 */
export function useBillingPoll({
  success,
  isSettled,
  queryClient,
  onPollTick
}: {
  success: boolean;
  isSettled: boolean;
  queryClient: QueryClient;
  onPollTick?: () => Promise<void>;
}): void {
  const router = useRouter();
  const pollStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!success || isSettled) return;

    if (pollStartRef.current === null) {
      pollStartRef.current = Date.now();
    }
    const startMs = pollStartRef.current;

    const timer = setInterval(async () => {
      if (hasPollTimedOut(startMs, Date.now())) {
        clearInterval(timer);
        return;
      }
      if (onPollTick) await onPollTick();
      queryClient.invalidateQueries({ queryKey: subscriptionQueryKey() });
      queryClient.invalidateQueries({ queryKey: bootstrapQueryKey() });
      router.invalidate();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [success, isSettled, queryClient, router, onPollTick]);
}
