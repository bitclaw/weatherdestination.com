import { beforeEach, describe, expect, it } from 'bun:test';
import { makeTestSharedDb } from '@/test/db';
import {
  clearFlagCache,
  getFlagEnabled,
  listFlags,
  removeFlag,
  upsertFlag
} from './feature-flags.server';

describe('feature_flags CRUD', () => {
  beforeEach(() => clearFlagCache());

  it('returns false for unknown flag', async () => {
    const db = makeTestSharedDb();
    expect(await getFlagEnabled(db, 'nonexistent')).toBe(false);
  });

  it('inserts flag and reads it back enabled', async () => {
    const db = makeTestSharedDb();
    await upsertFlag(db, 'new_ui', true);
    expect(await getFlagEnabled(db, 'new_ui')).toBe(true);
  });

  it('inserts flag disabled', async () => {
    const db = makeTestSharedDb();
    await upsertFlag(db, 'beta_feature', false);
    expect(await getFlagEnabled(db, 'beta_feature')).toBe(false);
  });

  it('toggles existing flag', async () => {
    const db = makeTestSharedDb();
    await upsertFlag(db, 'my_flag', true);
    await upsertFlag(db, 'my_flag', false);
    expect(await getFlagEnabled(db, 'my_flag')).toBe(false);
  });

  it('upsert is idempotent for same value', async () => {
    const db = makeTestSharedDb();
    await upsertFlag(db, 'stable_flag', true);
    await upsertFlag(db, 'stable_flag', true);
    const flags = await listFlags(db);
    expect(flags.filter(f => f.flag === 'stable_flag')).toHaveLength(1);
  });

  it('lists flags ordered by name', async () => {
    const db = makeTestSharedDb();
    await upsertFlag(db, 'zebra_flag', true);
    await upsertFlag(db, 'alpha_flag', false);
    const flags = await listFlags(db);
    expect(flags[0]?.flag).toBe('alpha_flag');
    expect(flags[1]?.flag).toBe('zebra_flag');
  });

  it('deletes flag', async () => {
    const db = makeTestSharedDb();
    await upsertFlag(db, 'to_delete', true);
    await removeFlag(db, 'to_delete');
    expect(await getFlagEnabled(db, 'to_delete')).toBe(false);
    const flags = await listFlags(db);
    expect(flags.find(f => f.flag === 'to_delete')).toBeUndefined();
  });

  it('deleting nonexistent flag is idempotent', async () => {
    const db = makeTestSharedDb();
    const result = await removeFlag(db, 'ghost');
    expect(result.ok).toBe(true);
  });
});
