import { useQuery } from '@tanstack/react-query';
import { getFeatureFlagFn } from '@/features/feature-flags';
import { featureFlagQueryKey } from '@/lib/query-keys';

/**
 * Check whether a feature flag is enabled for the current app.
 *
 * Flags are toggled in the admin panel at /dashboard/admin/feature-flags.
 * Results are cached for 1 minute.
 *
 * @example
 * const { enabled } = useFeatureFlag('new_checkout');
 * if (!enabled) return <OldCheckout />;
 * return <NewCheckout />;
 */
// DB flag names are runtime-defined by an admin with no redeploy , can't be
// statically typed without defeating that design goal.
export const useFeatureFlag = (flag: string) => {
  const query = useQuery({
    queryKey: featureFlagQueryKey(flag),
    queryFn: async () => {
      const result = await getFeatureFlagFn({ data: { flag } });
      return result.ok ? result.data : false;
    },
    staleTime: 60_000
  });

  return {
    enabled: query.data ?? false,
    isLoading: query.isLoading
  };
};
