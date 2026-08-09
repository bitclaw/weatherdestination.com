import { describe, expect, it } from 'bun:test';
import { makeTestDb } from '@/test/db';
import {
  getEncryptedSetting,
  getSetting,
  setEncryptedSetting,
  setSetting
} from './settings-helpers.server';

const TEST_ENC_KEY = 'a'.repeat(64);

describe('settings-helpers', () => {
  it('getSetting returns null for unset key', () => {
    const db = makeTestDb();
    expect(getSetting(db, 'missing')).toBeNull();
  });

  it('setSetting + getSetting round-trip', () => {
    const db = makeTestDb();
    setSetting(db, 'foo', 'bar');
    expect(getSetting(db, 'foo')).toBe('bar');
  });

  it('setSetting overwrites existing value', () => {
    const db = makeTestDb();
    setSetting(db, 'foo', 'first');
    setSetting(db, 'foo', 'second');
    expect(getSetting(db, 'foo')).toBe('second');
  });

  it('getEncryptedSetting returns null for unset key', () => {
    const db = makeTestDb();
    expect(getEncryptedSetting(db, 'missing', TEST_ENC_KEY)).toBeNull();
  });

  it('setEncryptedSetting + getEncryptedSetting round-trip', () => {
    const db = makeTestDb();
    setEncryptedSetting(db, 'secret', 'my-api-key', TEST_ENC_KEY);
    expect(getEncryptedSetting(db, 'secret', TEST_ENC_KEY)).toBe('my-api-key');
  });

  it('encrypted value is not stored in plaintext', () => {
    const db = makeTestDb();
    setEncryptedSetting(db, 'secret', 'my-api-key', TEST_ENC_KEY);
    const raw = getSetting(db, 'secret');
    expect(raw).not.toBe('my-api-key');
    expect(raw).not.toBeNull();
  });

  it('each encryption produces unique ciphertext', () => {
    const db = makeTestDb();
    setEncryptedSetting(db, 'a', 'same-value', TEST_ENC_KEY);
    const first = getSetting(db, 'a');
    setEncryptedSetting(db, 'a', 'same-value', TEST_ENC_KEY);
    const second = getSetting(db, 'a');
    expect(first).not.toBe(second);
    expect(getEncryptedSetting(db, 'a', TEST_ENC_KEY)).toBe('same-value');
  });
});
