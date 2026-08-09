import { queryOptions } from '@tanstack/react-query';
import { featureFlagsQueryKey } from '@/lib/query-keys';
import {
  deleteFeatureFlagFn,
  setFeatureFlagFn
} from './server/feature-flags.mutations';
import {
  getFeatureFlagFn,
  listFeatureFlagsFn
} from './server/feature-flags.queries';

export type { FeatureFlagRecord } from './server/feature-flags.server';
export {
  deleteFeatureFlagFn,
  getFeatureFlagFn,
  listFeatureFlagsFn,
  setFeatureFlagFn
};

export const featureFlagsQueryOptions = queryOptions({
  queryKey: featureFlagsQueryKey(),
  queryFn: async () => {
    const result = await listFeatureFlagsFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 60_000
});
