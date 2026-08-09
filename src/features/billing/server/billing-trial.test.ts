import { describe, expect, it } from 'bun:test';
import { resolveTrialDays } from './billing.server';
import { parseTrialEnd } from './stripe-shared.server';

describe('resolveTrialDays', () => {
  it('returns days when positive', () => {
    expect(resolveTrialDays(14)).toBe(14);
    expect(resolveTrialDays(1)).toBe(1);
  });

  it('returns undefined when 0', () => {
    expect(resolveTrialDays(0)).toBeUndefined();
  });

  it('returns undefined when undefined', () => {
    expect(resolveTrialDays(undefined)).toBeUndefined();
  });

  it('returns undefined when usedTrialBefore is true, even with valid trialDays', () => {
    expect(resolveTrialDays(14, true)).toBeUndefined();
  });

  it('returns days when usedTrialBefore is false', () => {
    expect(resolveTrialDays(14, false)).toBe(14);
  });
});

describe('parseTrialEnd', () => {
  it('converts unix timestamp to Date', () => {
    const ts = 1700000000;
    const result = parseTrialEnd(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(ts * 1000);
  });

  it('returns null for null', () => {
    expect(parseTrialEnd(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseTrialEnd(undefined)).toBeNull();
  });

  it('returns null for 0', () => {
    expect(parseTrialEnd(0)).toBeNull();
  });
});
