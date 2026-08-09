import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUIDv7 } from 'bun';
import { setSetting } from '@/lib/db/settings-helpers.server';
import { closeAllUserDbs, getUserDb } from '@/lib/db/user-db';
import { makeJob as makeJobBase } from './jobs-test-fixtures';
import { withEmailPreferenceGate } from './with-email-preference-gate';

type TestJobData = { userId: string; ping: string };

const makeJob = (userId: string) =>
  makeJobBase<TestJobData>('test:job', { userId, ping: 'pong' });

describe('withEmailPreferenceGate', () => {
  let originalDataDir: string | undefined;
  let tempRoot: string;

  beforeEach(() => {
    originalDataDir = process.env.USER_DATA_DIR;
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'warpkit-gate-'));
    process.env.USER_DATA_DIR = tempRoot;
  });

  afterEach(() => {
    closeAllUserDbs();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    process.env.USER_DATA_DIR = originalDataDir;
  });

  it('runs the handler when no preference row exists (opt-in default)', async () => {
    const userId = randomUUIDv7();
    let called = false;
    const handler = withEmailPreferenceGate<TestJobData>(
      'marketing_emails',
      async () => {
        called = true;
      }
    );

    await handler(makeJob(userId));
    expect(called).toBe(true);
  });

  it('skips the handler when the user opted out', async () => {
    const userId = randomUUIDv7();
    setSetting(getUserDb(userId), 'marketing_emails', '0');

    let called = false;
    const handler = withEmailPreferenceGate<TestJobData>(
      'marketing_emails',
      async () => {
        called = true;
      }
    );

    await handler(makeJob(userId));
    expect(called).toBe(false);
  });

  it('runs the handler when the user explicitly opted in', async () => {
    const userId = randomUUIDv7();
    setSetting(getUserDb(userId), 'marketing_emails', '1');

    let called = false;
    const handler = withEmailPreferenceGate<TestJobData>(
      'marketing_emails',
      async () => {
        called = true;
      }
    );

    await handler(makeJob(userId));
    expect(called).toBe(true);
  });
});
