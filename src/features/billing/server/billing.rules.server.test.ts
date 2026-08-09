import { describe, expect, it } from 'bun:test';
import { isSubscriptionActive } from './billing.rules.server';

describe('isSubscriptionActive', () => {
  it('returns true for status active', () => {
    expect(isSubscriptionActive({ status: 'active' })).toBe(true);
  });

  it('returns true for status trialing', () => {
    expect(isSubscriptionActive({ status: 'trialing' })).toBe(true);
  });

  it('returns false for status canceled', () => {
    expect(isSubscriptionActive({ status: 'canceled' })).toBe(false);
  });

  it('returns false for status past_due', () => {
    expect(isSubscriptionActive({ status: 'past_due' })).toBe(false);
  });

  it('returns false for status incomplete', () => {
    expect(isSubscriptionActive({ status: 'incomplete' })).toBe(false);
  });

  it('returns false for a null status', () => {
    expect(isSubscriptionActive({ status: null })).toBe(false);
  });

  it('returns false when there is no subscription at all', () => {
    expect(isSubscriptionActive(null)).toBe(false);
  });
});
