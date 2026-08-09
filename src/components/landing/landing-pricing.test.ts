import { describe, expect, it } from 'bun:test';
import { getPricingGridClass } from './landing-pricing';

describe('getPricingGridClass', () => {
  it('one-time mode: centered single-card layout', () => {
    expect(getPricingGridClass(1, true)).toBe('max-w-lg');
    expect(getPricingGridClass(3, true)).toBe('max-w-lg');
  });

  it('1 paid plan: centered single-card layout', () => {
    expect(getPricingGridClass(1, false)).toBe('max-w-lg');
  });

  it('2 paid plans: 2-col grid', () => {
    expect(getPricingGridClass(2, false)).toBe('max-w-3xl md:grid-cols-2');
  });

  it('3 paid plans: 3-col grid', () => {
    expect(getPricingGridClass(3, false)).toBe('max-w-5xl lg:grid-cols-3');
  });

  it('4+ paid plans: 4-col grid', () => {
    expect(getPricingGridClass(4, false)).toBe(
      'max-w-6xl sm:grid-cols-2 lg:grid-cols-4'
    );
  });
});
