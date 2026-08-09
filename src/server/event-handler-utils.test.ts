import { describe, expect, it } from 'bun:test';
import type { StripePlan } from '@/config';
import { resolveReceiptPlanName } from './event-handler-utils';

const makePlan = (id: string, name: string, priceId: string): StripePlan => ({
  id: id as StripePlan['id'],
  name,
  description: '',
  features: [],
  recurring: { priceId, price: 0 }
});

const plans: StripePlan[] = [
  makePlan('solo', 'Solo', 'price_solo_monthly'),
  makePlan('pro', 'Pro', 'price_pro_monthly'),
  makePlan('team', 'Team', 'price_team_monthly')
];

describe('resolveReceiptPlanName', () => {
  it('returns the plan name matching a monthly priceId', () => {
    expect(resolveReceiptPlanName(plans, 'price_pro_monthly')).toBe('Pro');
  });

  it('returns the plan name matching a team priceId', () => {
    expect(resolveReceiptPlanName(plans, 'price_team_monthly')).toBe('Team');
  });

  it('returns the first plan name when priceId is null (fallback)', () => {
    expect(resolveReceiptPlanName(plans, null)).toBe('Solo');
  });

  it('returns the first plan name when priceId is unknown (fallback)', () => {
    expect(resolveReceiptPlanName(plans, 'price_unknown_xxx')).toBe('Solo');
  });
});
