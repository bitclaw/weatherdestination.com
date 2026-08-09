import { beforeEach, describe, expect, it } from 'bun:test';
import { makeTestSharedDb } from '@/test/db';
import {
  clearFlagCache,
  getFlagEnabled,
  removeFlag,
  upsertFlag
} from './feature-flags.server';

describe('feature flag cache consistency', () => {
  beforeEach(() => {
    clearFlagCache();
  });

  it('upsertFlag updates cache for subsequent reads', async () => {
    const db = makeTestSharedDb();

    // Populate cache with false
    const before = await getFlagEnabled(db, 'cache_test_flag_1');
    expect(before).toBe(false);

    // Upsert to true should update both DB and cache
    await upsertFlag(db, 'cache_test_flag_1', true);

    // Read should get true from cache (not re-query DB)
    const after = await getFlagEnabled(db, 'cache_test_flag_1');
    expect(after).toBe(true);
  });

  it('deleteFlag clears cache for subsequent reads', async () => {
    const db = makeTestSharedDb();

    // Populate cache with true
    await upsertFlag(db, 'temp_flag', true);
    const before = await getFlagEnabled(db, 'temp_flag');
    expect(before).toBe(true);

    // Delete from DB and clear cache
    await removeFlag(db, 'temp_flag');

    // Should re-fetch from DB (via cache miss) and return false
    const after = await getFlagEnabled(db, 'temp_flag');
    expect(after).toBe(false);
  });

  it('sequential upserts propagate through cache', async () => {
    const db = makeTestSharedDb();

    await upsertFlag(db, 'toggle_flag', true);
    expect(await getFlagEnabled(db, 'toggle_flag')).toBe(true);

    await upsertFlag(db, 'toggle_flag', false);
    expect(await getFlagEnabled(db, 'toggle_flag')).toBe(false);

    await upsertFlag(db, 'toggle_flag', true);
    expect(await getFlagEnabled(db, 'toggle_flag')).toBe(true);
  });

  it('cache returns different values for different flags', async () => {
    const db = makeTestSharedDb();

    await upsertFlag(db, 'flag_a', true);
    await upsertFlag(db, 'flag_b', false);

    expect(await getFlagEnabled(db, 'flag_a')).toBe(true);
    expect(await getFlagEnabled(db, 'flag_b')).toBe(false);
  });
});
