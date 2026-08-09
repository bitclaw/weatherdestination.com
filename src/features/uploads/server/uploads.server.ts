import type { Database } from 'bun:sqlite';
import { S3Client } from '@aws-sdk/client-s3';
import { err, ok } from '@bitclaw/result';
import { randomUUIDv7 } from 'bun';
import { ERROR_CODES } from '@/lib/constants';
import type { FileRecord } from '../uploads.constants';

// Single source of truth for the S3 env vars , every uploads file reads the
// bucket name through this instead of its own `process.env.AWS_S3_FILES_BUCKET`,
// so there's one place to look when the config drifts from
// config.uploads.enabled (which is derived from the separate, client-exposed
// VITE_S3_FILES_BUCKET , see config.ts).
export const getS3Bucket = (): string | undefined =>
  process.env.AWS_S3_FILES_BUCKET;

export const getS3Client = () =>
  new S3Client({
    region: process.env.AWS_S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_S3_IAM_ACCESS_KEY ?? '',
      secretAccessKey: process.env.AWS_S3_IAM_SECRET_KEY ?? ''
    }
  });

type FileRow = {
  id: string;
  name: string;
  type: string;
  size: number;
  s3_key: string;
  created_at: number;
};

const toView = (row: FileRow): FileRecord => ({
  id: row.id,
  name: row.name,
  type: row.type,
  size: row.size,
  s3_key: row.s3_key,
  created_at: row.created_at
});

export const listFiles = (db: Database): FileRecord[] =>
  db
    .query<FileRow, []>('SELECT * FROM files ORDER BY created_at DESC, id DESC')
    .all()
    .map(toView);

export const getFileById = (db: Database, id: string): FileRecord | null => {
  const row = db
    .query<FileRow, [string]>('SELECT * FROM files WHERE id = ?')
    .get(id);
  return row ? toView(row) : null;
};

export const addFile = (
  db: Database,
  input: { name: string; type: string; size: number; s3Key: string }
) => {
  const id = randomUUIDv7();
  const now = Date.now();
  db.run(
    'INSERT INTO files (id, name, type, size, s3_key, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, input.name, input.type, input.size, input.s3Key, now]
  );
  return ok(getFileById(db, id) as FileRecord);
};

export const buildContentDispositionHeader = (filename: string): string =>
  `attachment; filename="${filename.replace(/"/g, '\\"')}"`;

export const deleteFileRow = (db: Database, id: string) => {
  const existing = db
    .query<{ id: string }, [string]>('SELECT id FROM files WHERE id = ?')
    .get(id);
  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'File not found.');

  db.run('DELETE FROM files WHERE id = ?', [id]);
  return ok({ deleted: true });
};
