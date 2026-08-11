import { describe, expect, it } from 'bun:test';
import { withJitter } from './use-update-available';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const POLL_JITTER_MS = 30 * 1000;
const RUNS = 100;

describe('withJitter', () => {
  it('stays within +/- POLL_JITTER_MS of the input across many runs', () => {
    for (let i = 0; i < RUNS; i++) {
      const result = withJitter(POLL_INTERVAL_MS);
      expect(result).toBeGreaterThanOrEqual(POLL_INTERVAL_MS - POLL_JITTER_MS);
      expect(result).toBeLessThanOrEqual(POLL_INTERVAL_MS + POLL_JITTER_MS);
    }
  });

  it('actually re-randomizes rather than returning a constant', () => {
    const results = new Set<number>();
    for (let i = 0; i < RUNS; i++) {
      results.add(withJitter(POLL_INTERVAL_MS));
    }
    // 100 draws from a continuous range colliding down to a single value is
    // effectively impossible unless withJitter stopped randomizing.
    expect(results.size).toBeGreaterThan(1);
  });
});
