import { queryOptions } from '@tanstack/react-query';
import { sidebarPreferencesQueryKey } from '@/lib/query-keys';
import { getSidebarPreferencesFn } from './server/sidebar-preferences.queries';

export const sidebarPreferencesQueryOptions = queryOptions({
  queryKey: sidebarPreferencesQueryKey(),
  queryFn: async () => {
    const result = await getSidebarPreferencesFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 30_000
});

export { updateSidebarPreferencesFn } from './server/sidebar-preferences.mutations';
