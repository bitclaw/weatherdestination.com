import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { logUserEvent } from '@/lib/db/user-events';
import { runUserMigrations } from '@/lib/db/user-migrations';
import { makeTestDb } from '@/test/db';
import {
  addFile,
  buildContentDispositionHeader,
  deleteFileRow,
  getFileById,
  listFiles
} from './uploads.server';

describe('files migration', () => {
  it('creates files table on fresh DB', () => {
    const db = new Database(':memory:');
    runUserMigrations(db);
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='files'"
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

describe('uploads.server', () => {
  it('returns empty list for fresh DB', () => {
    const db = makeTestDb();
    expect(listFiles(db)).toEqual([]);
  });

  it('adds a file and retrieves by id', () => {
    const db = makeTestDb();
    const result = addFile(db, {
      name: 'photo.jpg',
      type: 'image/jpeg',
      size: 1024,
      s3Key: 'user-1/abc.jpg'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe('photo.jpg');
    expect(result.data.type).toBe('image/jpeg');
    expect(result.data.size).toBe(1024);
    expect(result.data.s3_key).toBe('user-1/abc.jpg');
    expect(result.data.created_at).toBeGreaterThan(0);
  });

  it('lists files newest first', () => {
    const db = makeTestDb();
    const a = addFile(db, {
      name: 'a.jpg',
      type: 'image/jpeg',
      size: 1,
      s3Key: 'a'
    });
    const b = addFile(db, {
      name: 'b.jpg',
      type: 'image/jpeg',
      size: 1,
      s3Key: 'b'
    });
    const c = addFile(db, {
      name: 'c.jpg',
      type: 'image/jpeg',
      size: 1,
      s3Key: 'c'
    });

    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!a.ok || !b.ok || !c.ok) return;

    const files = listFiles(db);
    expect(files).toHaveLength(3);
    expect(files.at(0)?.id).toBe(c.data.id);
    expect(files.at(1)?.id).toBe(b.data.id);
    expect(files.at(2)?.id).toBe(a.data.id);
  });

  it('getFileById returns null for nonexistent id', () => {
    const db = makeTestDb();
    expect(getFileById(db, 'nonexistent')).toBeNull();
  });

  it('deleteFileRow removes the row', () => {
    const db = makeTestDb();
    const created = addFile(db, {
      name: 'del.pdf',
      type: 'application/pdf',
      size: 512,
      s3Key: 's3/del.pdf'
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const del = deleteFileRow(db, created.data.id);
    expect(del.ok).toBe(true);
    expect(listFiles(db)).toHaveLength(0);
  });

  it('deleteFileRow returns NOT_FOUND for missing id', () => {
    const db = makeTestDb();
    const result = deleteFileRow(db, 'ghost');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it("addFile does NOT write a user event , event logging is the caller's responsibility", () => {
    const db = makeTestDb();
    addFile(db, {
      name: 'report.pdf',
      type: 'application/pdf',
      size: 2048,
      s3Key: 'u/r.pdf'
    });

    const events = db
      .query<{ type: string }, []>(
        "SELECT type FROM user_events WHERE type = 'file.uploaded'"
      )
      .all();
    expect(events).toHaveLength(0);
  });

  it('addFile + caller logUserEvent = exactly 1 file.uploaded event', () => {
    const db = makeTestDb();
    addFile(db, {
      name: 'report.pdf',
      type: 'application/pdf',
      size: 2048,
      s3Key: 'u/r.pdf'
    });
    logUserEvent(db, 'file.uploaded', { name: 'report.pdf' });

    const events = db
      .query<{ type: string }, []>(
        "SELECT type FROM user_events WHERE type = 'file.uploaded'"
      )
      .all();
    expect(events).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildContentDispositionHeader
// ---------------------------------------------------------------------------

describe('buildContentDispositionHeader', () => {
  it('returns plain filename unchanged', () => {
    expect(buildContentDispositionHeader('photo.jpg')).toBe(
      'attachment; filename="photo.jpg"'
    );
  });

  it('escapes double-quote characters instead of stripping them', () => {
    expect(buildContentDispositionHeader('my "special" file.jpg')).toBe(
      'attachment; filename="my \\"special\\" file.jpg"'
    );
  });

  it('preserves spaces in filename', () => {
    expect(buildContentDispositionHeader('my file name.pdf')).toBe(
      'attachment; filename="my file name.pdf"'
    );
  });
});
