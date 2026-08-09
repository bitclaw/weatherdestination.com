import { describe, expect, it } from 'bun:test';
import path from 'node:path';
import { getUserDbPath } from './user-db';

describe('getUserDbPath', () => {
  const dataDir = path.resolve(
    process.env.USER_DATA_DIR ?? path.join('data', 'users')
  );

  it('stays within data dir for a normal userId', () => {
    const result = getUserDbPath('abc123def456');
    expect(result.startsWith(dataDir + path.sep)).toBe(true);
  });

  it('throws on path traversal sequences', () => {
    expect(() => getUserDbPath('../../../etc/passwd')).toThrow();
  });

  it('throws on absolute path segments', () => {
    expect(() => getUserDbPath('/etc/passwd')).toThrow();
  });

  it('throws on userId with embedded null byte that traverses up', () => {
    expect(() => getUserDbPath('valid\x00/../../../etc')).toThrow();
  });

  it('works correctly when USER_DATA_DIR is a relative path', () => {
    const orig = process.env.USER_DATA_DIR;
    process.env.USER_DATA_DIR = 'data/users';
    try {
      const result = getUserDbPath('abc123def456');
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain('abc123def456');
    } finally {
      if (orig === undefined) delete process.env.USER_DATA_DIR;
      else process.env.USER_DATA_DIR = orig;
    }
  });

  it('prefers RUNMIST_DATA_DIR over USER_DATA_DIR when both are set', () => {
    const origRunmist = process.env.RUNMIST_DATA_DIR;
    const origUser = process.env.USER_DATA_DIR;
    process.env.RUNMIST_DATA_DIR = '/home/deploy/my-app-abc12345/shared/data';
    process.env.USER_DATA_DIR = 'data/users';
    try {
      const result = getUserDbPath('abc123def456');
      expect(result).toBe(
        '/home/deploy/my-app-abc12345/shared/data/users/abc123def456/user.db'
      );
    } finally {
      if (origRunmist === undefined) delete process.env.RUNMIST_DATA_DIR;
      else process.env.RUNMIST_DATA_DIR = origRunmist;
      if (origUser === undefined) delete process.env.USER_DATA_DIR;
      else process.env.USER_DATA_DIR = origUser;
    }
  });

  it('falls back to USER_DATA_DIR when RUNMIST_DATA_DIR is unset', () => {
    const origRunmist = process.env.RUNMIST_DATA_DIR;
    delete process.env.RUNMIST_DATA_DIR;
    try {
      const result = getUserDbPath('abc123def456');
      expect(result.startsWith(dataDir + path.sep)).toBe(true);
    } finally {
      if (origRunmist !== undefined) process.env.RUNMIST_DATA_DIR = origRunmist;
    }
  });
});
