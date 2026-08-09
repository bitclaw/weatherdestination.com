import { queryOptions } from '@tanstack/react-query';
import { creditsQueryKey } from '@/lib/query-keys';
import { getCreditsFn } from './server/credits.queries';

export { buyCreditsCheckoutFn } from './server/credits.mutations';
export { getCreditsFn } from './server/credits.queries';

export const creditsQueryOptions = queryOptions({
  queryKey: creditsQueryKey(),
  queryFn: async () => {
    const result = await getCreditsFn();
    return result.ok ? result.data : 0;
  },
  staleTime: 30_000
});
