import { afterEach, describe, expect, it } from 'bun:test';
import { _clearHandlers, emit, on } from './events';

describe('domain events', () => {
  afterEach(() => _clearHandlers());

  it('calls handler with correct payload', async () => {
    _clearHandlers();
    const calls: unknown[] = [];
    on('account.deleted', async p => {
      calls.push(p);
    });
    await emit('account.deleted', { userId: 'u1' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ userId: 'u1' });
  });

  it('calls multiple handlers registered for same event', async () => {
    _clearHandlers();
    const calls1: unknown[] = [];
    const calls2: unknown[] = [];
    on('account.deleted', async p => {
      calls1.push(p);
    });
    on('account.deleted', async p => {
      calls2.push(p);
    });
    await emit('account.deleted', { userId: 'u1' });
    expect(calls1).toHaveLength(1);
    expect(calls2).toHaveLength(1);
  });

  it('does not throw when a handler errors', async () => {
    _clearHandlers();
    on('credits.purchased', async () => {
      throw new Error('handler exploded');
    });
    await expect(
      emit('credits.purchased', { userId: 'u1', amount: 100 })
    ).resolves.toBeUndefined();
  });

  it('still runs subsequent handlers after one fails', async () => {
    _clearHandlers();
    const calls: unknown[] = [];
    on('credits.purchased', async () => {
      throw new Error('first handler fails');
    });
    on('credits.purchased', async p => {
      calls.push(p);
    });
    await emit('credits.purchased', { userId: 'u1', amount: 100 });
    expect(calls).toHaveLength(1);
  });

  it('does not call handler registered for a different event', async () => {
    _clearHandlers();
    const calls: unknown[] = [];
    on('subscription.activated', async p => {
      calls.push(p);
    });
    await emit('account.deleted', { userId: 'u1' });
    expect(calls).toHaveLength(0);
  });

  it('no-op emit when no handlers registered', async () => {
    _clearHandlers();
    await expect(
      emit('credits.purchased', { userId: 'u1', amount: 100 })
    ).resolves.toBeUndefined();
  });
});
