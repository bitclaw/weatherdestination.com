import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { getUserDb } from '@/lib/db/user-db';
import { requireUser } from '@/server/require-user';
import { getNoteById, listNotes } from './notes.server';

export const listNotesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const db = getUserDb(user.id);
    return ok(listNotes(db));
  }
);

export const getNoteDetailFn = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().min(1).max(36) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');
    const db = getUserDb(user.id);
    const note = getNoteById(db, data.id);
    if (!note) return err(ERROR_CODES.NOT_FOUND, 'Note not found.');
    return ok(note);
  });
