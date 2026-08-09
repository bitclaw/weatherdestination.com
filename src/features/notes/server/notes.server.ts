import type { Database } from 'bun:sqlite';
import { err, ok } from '@bitclaw/result';
import { randomUUIDv7 } from 'bun';
import { ERROR_CODES } from '@/lib/constants';
import type { NoteRecord } from '../notes.constants';

type NoteRow = {
  id: string;
  title: string;
  content: string;
  pinned: number;
  created_at: number;
  updated_at: number;
};

const toView = (row: NoteRow): NoteRecord => ({
  id: row.id,
  title: row.title,
  content: row.content,
  pinned: row.pinned === 1,
  created_at: row.created_at,
  updated_at: row.updated_at
});

export const listNotes = (db: Database): NoteRecord[] =>
  db
    .query<NoteRow, []>(
      'SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC, id DESC'
    )
    .all()
    .map(toView);

export const getNoteById = (db: Database, id: string): NoteRecord | null => {
  const row = db
    .query<NoteRow, [string]>('SELECT * FROM notes WHERE id = ?')
    .get(id);
  return row ? toView(row) : null;
};

export const createNote = (
  db: Database,
  input: { title: string; content?: string }
) => {
  const now = Date.now();
  const id = randomUUIDv7();
  db.run(
    'INSERT INTO notes (id, title, content, pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
    [id, input.title.trim(), input.content?.trim() ?? '', now, now]
  );
  return ok(getNoteById(db, id) as NoteRecord);
};

export const updateNote = (
  db: Database,
  input: { id: string; title: string; content?: string }
) => {
  const existing = db
    .query<{ id: string }, [string]>('SELECT id FROM notes WHERE id = ?')
    .get(input.id);
  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'Note not found.');

  const now = Date.now();
  db.run(
    'UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?',
    [input.title.trim(), input.content?.trim() ?? '', now, input.id]
  );
  return ok(getNoteById(db, input.id) as NoteRecord);
};

export const deleteNote = (db: Database, id: string) => {
  const existing = db
    .query<{ id: string }, [string]>('SELECT id FROM notes WHERE id = ?')
    .get(id);
  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'Note not found.');

  db.run('DELETE FROM notes WHERE id = ?', [id]);
  return ok({ deleted: true });
};

export const togglePin = (db: Database, id: string) => {
  const existing = db
    .query<{ pinned: number }, [string]>(
      'SELECT pinned FROM notes WHERE id = ?'
    )
    .get(id);
  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'Note not found.');

  const newPinned = existing.pinned === 1 ? 0 : 1;
  db.run('UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?', [
    newPinned,
    Date.now(),
    id
  ]);
  return ok(getNoteById(db, id) as NoteRecord);
};
