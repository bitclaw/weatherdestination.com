import { queryOptions } from '@tanstack/react-query';
import { uploadsQueryKey } from '@/lib/query-keys';
import { listUploadsFn } from './server/uploads.queries';

export const uploadsQueryOptions = queryOptions({
  queryKey: uploadsQueryKey(),
  queryFn: async () => {
    const result = await listUploadsFn();
    return result.ok
      ? result.data
      : ([] as import('./uploads.constants').FileRecord[]);
  },
  staleTime: 30_000
});

export {
  addUploadToDbFn,
  deleteUploadFn,
  getUploadUrlFn
} from './server/uploads.mutations';
export { getDownloadUrlFn, listUploadsFn } from './server/uploads.queries';
export type { FileRecord } from './uploads.constants';
export {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES
} from './uploads.constants';
