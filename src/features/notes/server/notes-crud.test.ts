import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { runUserMigrations } from '@/lib/db/user-migrations';
import { makeTestDb } from '@/test/db';
import {
  createNote,
  deleteNote,
  getNoteById,
  listNotes,
  togglePin,
  updateNote
} from './notes.server';

describe('notes migration', () => {
  it('creates notes table on fresh DB', () => {
    const db = new Database(':memory:');
    runUserMigrations(db);
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='notes'"
      )
      .all();
    expect(tables).toHaveLength(1);
  });

  it('is idempotent: running migrations twice does not error', () => {
    const db = new Database(':memory:');
    runUserMigrations(db);
    runUserMigrations(db);
  });
});

describe('notes.server', () => {
  it('returns empty list for fresh DB', () => {
    const db = makeTestDb();
    expect(listNotes(db)).toEqual([]);
  });

  it('creates a note with defaults', () => {
    const db = makeTestDb();
    const result = createNote(db, { title: 'First note' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('First note');
    expect(result.data.content).toBe('');
    expect(result.data.pinned).toBe(false);
    expect(result.data.created_at).toBeGreaterThan(0);
    expect(result.data.updated_at).toBeGreaterThan(0);
  });

  it('creates a note with content', () => {
    const db = makeTestDb();
    const result = createNote(db, {
      title: 'With content',
      content: 'Hello world'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.content).toBe('Hello world');
  });

  it('lists notes pinned first, then by updated_at DESC', () => {
    const db = makeTestDb();
    const a = createNote(db, { title: 'A' });
    const b = createNote(db, { title: 'B' });
    const c = createNote(db, { title: 'C' });

    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!a.ok || !b.ok || !c.ok) return;

    togglePin(db, a.data.id);

    const notes = listNotes(db);
    expect(notes).toHaveLength(3);
    expect(notes.at(0)?.id).toBe(a.data.id);
    expect(notes.at(0)?.pinned).toBe(true);
    expect(notes.at(1)?.id).toBe(c.data.id);
    expect(notes.at(2)?.id).toBe(b.data.id);
  });

  it('gets note by id', () => {
    const db = makeTestDb();
    const result = createNote(db, { title: 'Find me' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getNoteById(db, result.data.id)?.title).toBe('Find me');
    expect(getNoteById(db, 'nonexistent')).toBeNull();
  });

  it('updates title and content', () => {
    const db = makeTestDb();
    const created = createNote(db, { title: 'Original' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = updateNote(db, {
      id: created.data.id,
      title: 'Updated',
      content: 'New content'
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.title).toBe('Updated');
    expect(updated.data.content).toBe('New content');
    expect(updated.data.updated_at).toBeGreaterThanOrEqual(
      created.data.updated_at
    );
  });

  it('returns NOT_FOUND when updating nonexistent note', () => {
    const db = makeTestDb();
    const result = updateNote(db, { id: 'ghost', title: 'Ghost' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('deletes a note', () => {
    const db = makeTestDb();
    const created = createNote(db, { title: 'Delete me' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deleted = deleteNote(db, created.data.id);
    expect(deleted.ok).toBe(true);
    expect(listNotes(db)).toHaveLength(0);
  });

  it('returns NOT_FOUND when deleting nonexistent note', () => {
    const db = makeTestDb();
    const result = deleteNote(db, 'ghost');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('togglePin flips pinned bit', () => {
    const db = makeTestDb();
    const created = createNote(db, { title: 'Pin me' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const pinned = togglePin(db, created.data.id);
    expect(pinned.ok).toBe(true);
    if (!pinned.ok) return;
    expect(pinned.data.pinned).toBe(true);

    const unpinned = togglePin(db, created.data.id);
    expect(unpinned.ok).toBe(true);
    if (!unpinned.ok) return;
    expect(unpinned.data.pinned).toBe(false);
  });

  it('togglePin returns the fresh updated_at, not a stale pre-write value', () => {
    const db = makeTestDb();
    const created = createNote(db, { title: 'Pin me' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const before = created.data.updated_at;
    // Force a distinct timestamp - Date.now() can tie with the create call
    // on a fast test run, which would make this assertion vacuous.
    while (Date.now() <= before) {
      /* spin */
    }

    const pinned = togglePin(db, created.data.id);
    expect(pinned.ok).toBe(true);
    if (!pinned.ok) return;

    const fetched = getNoteById(db, created.data.id);
    expect(pinned.data.updated_at).toBe(fetched?.updated_at as number);
    expect(pinned.data.updated_at).toBeGreaterThan(before);
  });
});
