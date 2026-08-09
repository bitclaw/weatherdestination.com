import { describe, expect, it } from 'bun:test';
import { checkEntitlement, getPlanLimits } from './entitlements';

describe('checkEntitlement', () => {
  it('allows free plan when under limit', () => {
    const { maxNotes: limit } = getPlanLimits('free');
    const result = checkEntitlement('free', 'maxNotes', 0);
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.limit).toBe(limit);
  });

  it('allows free plan one below limit', () => {
    const { maxNotes: limit } = getPlanLimits('free');
    const result = checkEntitlement('free', 'maxNotes', limit - 1);
    expect(result.allowed).toBe(true);
  });

  it('denies free plan at limit', () => {
    const { maxNotes: limit } = getPlanLimits('free');
    const result = checkEntitlement('free', 'maxNotes', limit);
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(limit);
    expect(result.limit).toBe(limit);
  });

  it('allows pro plan regardless of count', () => {
    expect(checkEntitlement('pro', 'maxNotes', 0).allowed).toBe(true);
    expect(checkEntitlement('pro', 'maxNotes', 999).allowed).toBe(true);
    expect(checkEntitlement('pro', 'maxNotes', 1_000_000).allowed).toBe(true);
  });

  it('allows team plan regardless of count', () => {
    expect(checkEntitlement('team', 'maxNotes', 999).allowed).toBe(true);
  });

  it('gates file uploads on free plan', () => {
    const { maxFileUploads: limit } = getPlanLimits('free');
    expect(checkEntitlement('free', 'maxFileUploads', 0).allowed).toBe(true);
    expect(checkEntitlement('free', 'maxFileUploads', limit - 1).allowed).toBe(
      true
    );
    expect(checkEntitlement('free', 'maxFileUploads', limit).allowed).toBe(
      false
    );
  });

  it('allows unlimited file uploads on pro plan', () => {
    expect(checkEntitlement('pro', 'maxFileUploads', 9999).allowed).toBe(true);
  });

  it('gates solo plan at its finite api-key limit boundary', () => {
    const { maxApiKeys: limit } = getPlanLimits('solo');
    expect(checkEntitlement('solo', 'maxApiKeys', limit - 1).allowed).toBe(
      true
    );
    expect(checkEntitlement('solo', 'maxApiKeys', limit).allowed).toBe(false);
  });

  it('treats -1 as unlimited, not as a numeric ceiling', () => {
    const { maxNotes } = getPlanLimits('pro');
    expect(maxNotes).toBe(-1);
    const result = checkEntitlement('pro', 'maxNotes', Number.MAX_SAFE_INTEGER);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
  });
});
