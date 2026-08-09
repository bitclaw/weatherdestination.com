import { queryOptions } from '@tanstack/react-query';
import {
  citiesQueryKey,
  cityComparisonQueryKey,
  reportAccessQueryKey
} from '@/lib/query-keys';
import {
  compareCitiesFn,
  listCitiesFn,
  reportAccessFn
} from './server/weather.queries';

export { combinedScore, sadRiskScore } from './server/scoring';

export const citiesQueryOptions = queryOptions({
  queryKey: citiesQueryKey(),
  queryFn: async () => {
    const result = await listCitiesFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 5 * 60_000
});

export const cityComparisonQueryOptions = (cityIds: string[]) =>
  queryOptions({
    queryKey: cityComparisonQueryKey(cityIds),
    queryFn: async () => {
      const result = await compareCitiesFn({ data: { cityIds } });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: cityIds.length >= 2 && cityIds.length <= 5,
    staleTime: 60_000
  });

export const reportAccessQueryOptions = queryOptions({
  queryKey: reportAccessQueryKey(),
  queryFn: async () => {
    const result = await reportAccessFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 60_000
});
