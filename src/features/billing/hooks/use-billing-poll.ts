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
 * Usage:
 *   useBillingPoll({ success, isSettled, queryClient });
 */
export function useBillingPoll({
  success,
  isSettled,
  queryClient
}: {
  success: boolean;
  isSettled: boolean;
  queryClient: QueryClient;
}): void {
  const router = useRouter();
  const pollStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!success || isSettled) return;

    if (pollStartRef.current === null) {
      pollStartRef.current = Date.now();
    }
    const startMs = pollStartRef.current;

    const timer = setInterval(() => {
      if (hasPollTimedOut(startMs, Date.now())) {
        clearInterval(timer);
        return;
      }
      queryClient.invalidateQueries({ queryKey: subscriptionQueryKey() });
      queryClient.invalidateQueries({ queryKey: bootstrapQueryKey() });
      router.invalidate();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [success, isSettled, queryClient, router]);
}
