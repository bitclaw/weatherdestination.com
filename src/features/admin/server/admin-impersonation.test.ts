import { afterEach, describe, expect, it } from 'bun:test';
import { _clearHandlers, on } from '@/server/events';
import { recordImpersonationStart } from './admin.server';

describe('recordImpersonationStart', () => {
  afterEach(() => _clearHandlers());

  it('emits admin.impersonation.started with the correct payload', async () => {
    const calls: unknown[] = [];
    on('admin.impersonation.started', async payload => {
      calls.push(payload);
    });

    await recordImpersonationStart('admin-1', 'target-1');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      adminUserId: 'admin-1',
      targetUserId: 'target-1'
    });
  });

  it('does not throw when no handler is registered', async () => {
    await expect(
      recordImpersonationStart('admin-2', 'target-2')
    ).resolves.toBeUndefined();
  });
});
