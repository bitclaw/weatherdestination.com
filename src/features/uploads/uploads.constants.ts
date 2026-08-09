import { z } from 'zod';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'video/mp4'
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Maps the validated MIME type to the extension stored in the S3 key -
// deliberately NOT derived from the client-supplied filename. The presign
// policy already pins Content-Type to this enum, but without this the key
// itself could carry an arbitrary attacker-chosen extension (.html, .svg,
// .js) regardless of the declared MIME type; harmless while objects are
// only ever served via presigned GET with Content-Disposition: attachment,
// but a bucket later put behind public/CDN read (a common fork
// modification) would let a static-serving layer that derives content-type
// from the key extension turn this into stored XSS.
export const MIME_TYPE_EXTENSIONS: Record<AllowedMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'video/mp4': '.mp4'
};

export type FileRecord = {
  id: string;
  name: string;
  type: string;
  size: number;
  s3_key: string;
  created_at: number;
};

export const uploadRequestSchema = z.object({
  name: z.string().min(1).max(500),
  type: z.enum(ALLOWED_MIME_TYPES),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES)
});

export const addUploadSchema = z.object({
  s3Key: z.string().min(1).max(500),
  name: z.string().min(1).max(500),
  type: z.enum(ALLOWED_MIME_TYPES),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES)
});
