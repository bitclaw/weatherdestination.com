import type { Database } from 'bun:sqlite';
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
// NIST SP 800-38D specifies 96 bits (12 bytes) for GCM; 16 was a gratuitous
// deviation with no security benefit (just an extra GHASH block). Safe to
// change with no migration: the stored format is `iv:tag:encrypted`, three
// separately hex-delimited fields, not a fixed-offset concatenation -
// decrypt() reads whatever length ivHex actually is, so old 16-byte-IV
// values already in the DB keep decrypting correctly; only newly-written
// values get the shorter IV.
const IV_LENGTH = 12;

const encrypt = (value: string, keyHex: string): string => {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (encoded: string, keyHex: string): string => {
  const [ivHex, tagHex, encHex] = encoded.split(':') as [
    string,
    string,
    string
  ];
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const key = Buffer.from(keyHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
};

export const getSetting = (db: Database, key: string): string | null => {
  const row = db
    .query<{ value: string }, [string]>(
      'SELECT value FROM settings WHERE key = ?'
    )
    .get(key);
  return row?.value ?? null;
};

export const setSetting = (db: Database, key: string, value: string): void => {
  db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch())
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
    [key, value]
  );
};

export const getEncryptedSetting = (
  db: Database,
  key: string,
  encryptionKey: string
): string | null => {
  const raw = getSetting(db, key);
  if (!raw) return null;
  return decrypt(raw, encryptionKey);
};

export const setEncryptedSetting = (
  db: Database,
  key: string,
  value: string,
  encryptionKey: string
): void => {
  setSetting(db, key, encrypt(value, encryptionKey));
};
