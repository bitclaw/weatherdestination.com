import { queryOptions } from '@tanstack/react-query';
import { apiKeysQueryKey } from '@/lib/query-keys';
import { getApiKeysFn } from './server/api-keys.queries';

export type { ApiKeyRecord } from './api-keys.constants';
export { ApiKeyCreateDialog } from './components/api-key-create-dialog';
export { ApiKeysTable } from './components/api-keys-table';
export {
  createApiKeyFn,
  deleteApiKeyFn,
  revokeApiKeyFn,
  touchApiKeyFn
} from './server/api-keys.mutations';
export { getApiKeysFn };

export const apiKeysQueryOptions = queryOptions({
  queryKey: apiKeysQueryKey(),
  queryFn: async () => {
    const result = await getApiKeysFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 30_000
});
