import { queryOptions } from '@tanstack/react-query';
import { featureRequestsQueryKey } from '@/lib/query-keys';
import { getFeatureRequestsFn } from './server/feature-requests.queries';

export { FeatureRequestsTable } from './components/feature-requests-table';
export type { FeatureRequestRecord } from './feature-requests.constants';
export {
  createFeatureRequestFn,
  deleteFeatureRequestFn,
  toggleFeatureRequestVoteFn,
  updateFeatureRequestFn
} from './server/feature-requests.mutations';
export { getFeatureRequestsFn };

export const featureRequestsQueryOptions = queryOptions({
  queryKey: featureRequestsQueryKey(),
  queryFn: async () => {
    const result = await getFeatureRequestsFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 30_000
});
