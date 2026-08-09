import { describe, expect, it } from 'bun:test';
import type { cities } from '@/lib/db/schema';
import { combinedScore, sadRiskScore } from './scoring';

type City = typeof cities.$inferSelect;

const city = (overrides: Partial<City>): City => ({
  id: 'test-id',
  name: 'Test City',
  state: 'Test State',
  stateCode: 'TS',
  latitude: 40,
  longitude: -100,
  population: 500000,
  wildfireRisk: 20,
  floodRisk: 20,
  hurricaneRisk: 20,
  heatWaveRisk: 20,
  droughtRisk: 20,
  avgSunshineHours: 7,
  avgCloudCover: 45,
  avgTempHigh: 65,
  avgTempLow: 45,
  costOfLivingIndex: 100,
  airQualityIndex: 45,
  dataLastUpdated: null,
  createdAt: new Date(),
  ...overrides
});

// Seattle: high latitude, low sunshine, high cloud cover - real seed values.
const seattle = city({
  name: 'Seattle',
  stateCode: 'WA',
  latitude: 47.6062,
  wildfireRisk: 25,
  floodRisk: 20,
  hurricaneRisk: 5,
  heatWaveRisk: 15,
  droughtRisk: 20,
  avgSunshineHours: 4.5,
  avgCloudCover: 65,
  costOfLivingIndex: 145,
  airQualityIndex: 35
});

// Miami: low latitude, high sunshine, but severe hurricane/flood risk.
const miami = city({
  name: 'Miami',
  stateCode: 'FL',
  latitude: 25.7617,
  wildfireRisk: 15,
  floodRisk: 85,
  hurricaneRisk: 95,
  heatWaveRisk: 65,
  droughtRisk: 25,
  avgSunshineHours: 8.5,
  avgCloudCover: 30,
  costOfLivingIndex: 125,
  airQualityIndex: 40
});

// Denver: moderate latitude, high sunshine, low disaster risk overall.
const denver = city({
  name: 'Denver',
  stateCode: 'CO',
  latitude: 39.7392,
  wildfireRisk: 45,
  floodRisk: 20,
  hurricaneRisk: 5,
  heatWaveRisk: 30,
  droughtRisk: 50,
  avgSunshineHours: 8.5,
  avgCloudCover: 30,
  costOfLivingIndex: 125,
  airQualityIndex: 42
});

describe('sadRiskScore', () => {
  it('scores a high-latitude, low-sunshine, high-cloud city higher than a sunny low-latitude one', () => {
    expect(sadRiskScore(seattle)).toBeGreaterThan(sadRiskScore(miami));
  });

  it('stays within 0-100', () => {
    for (const c of [seattle, miami, denver]) {
      const score = sadRiskScore(c);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('scores a null island fixture (equator, max sunshine, no cloud) near zero', () => {
    const sunny = city({
      latitude: 20,
      avgSunshineHours: 11,
      avgCloudCover: 0
    });
    expect(sadRiskScore(sunny)).toBe(0);
  });
});

describe('combinedScore', () => {
  it('stays within 0-100', () => {
    for (const c of [seattle, miami, denver]) {
      const { score } = combinedScore(c);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('scores a low-disaster-risk city higher than a severe-hurricane-risk city', () => {
    expect(combinedScore(denver).score).toBeGreaterThan(
      combinedScore(miami).score
    );
  });

  it("identifies hurricane risk as Miami's top concern", () => {
    expect(combinedScore(miami).topConcern.label).toBe('hurricane risk');
  });

  it("identifies seasonal depression risk as Seattle's top concern", () => {
    expect(combinedScore(seattle).topConcern.label).toBe(
      'seasonal depression risk'
    );
  });

  it('includes the city name and score in the recommendation text', () => {
    const { score, recommendation } = combinedScore(denver);
    expect(recommendation).toContain('Denver, CO');
    expect(recommendation).toContain(`${score}/100`);
  });
});
