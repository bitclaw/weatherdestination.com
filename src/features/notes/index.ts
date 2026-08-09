import { queryOptions } from '@tanstack/react-query';
import { noteDetailQueryKey, notesQueryKey } from '@/lib/query-keys';
import { getNoteDetailFn, listNotesFn } from './server/notes.queries';

export const notesQueryOptions = queryOptions({
  queryKey: notesQueryKey(),
  queryFn: async () => {
    const result = await listNotesFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 30_000
});

export const noteDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: noteDetailQueryKey(id),
    queryFn: async () => {
      const result = await getNoteDetailFn({ data: { id } });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: 30_000
  });

export type { NoteRecord } from './notes.constants';
export {
  createNoteFn,
  deleteNoteFn,
  togglePinFn,
  updateNoteFn
} from './server/notes.mutations';
