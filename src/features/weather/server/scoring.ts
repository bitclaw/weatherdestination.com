// Climate-safety + SAD (Seasonal Affective Disorder) scoring, the paid
// report's core differentiator per docs/weatherdestination/sad-relocation-
// research.md - competitors show raw risk numbers ("Miami has 95% hurricane
// risk"), this turns them into a single comparable score and a plain-
// language recommendation ("Move to Duluth").
//
// Data provenance: city fields are hand-curated values ported from the
// pre-rewrite site (see src/lib/db/seed-data/cities.ts), not freshly
// NOAA-verified. Directionally sane on spot-check, not authoritative -
// callers rendering this in the paid report should disclose that.
import type { cities } from '@/lib/db/schema';

type City = typeof cities.$inferSelect;

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

// Higher = more seasonal-depression risk. Three factors, roughly equal
// weight: latitude (shorter winter daylight further north), average daily
// sunshine hours (directly reduces SAD-linked light exposure), and cloud
// cover (blocks what sunshine there is even during daylight hours).
export const sadRiskScore = (city: City): number => {
  const latRisk = clamp(((city.latitude - 20) / (65 - 20)) * 100);
  const sunshineRisk = clamp(((11 - city.avgSunshineHours) / (11 - 4)) * 100);
  const cloudRisk = clamp(city.avgCloudCover);

  return Math.round(0.35 * latRisk + 0.35 * sunshineRisk + 0.3 * cloudRisk);
};

type RiskFactor = {
  label: string;
  value: number;
};

const riskFactors = (city: City, sadRisk: number): RiskFactor[] => [
  { label: 'wildfire risk', value: city.wildfireRisk },
  { label: 'flood risk', value: city.floodRisk },
  { label: 'hurricane risk', value: city.hurricaneRisk },
  { label: 'heat wave risk', value: city.heatWaveRisk },
  { label: 'drought risk', value: city.droughtRisk },
  { label: 'seasonal depression risk', value: sadRisk }
];

// Cost of living: 100 = national average in this dataset. Above-average
// cost is a real downside for a relocation decision, so it factors in as a
// penalty, not just the disaster/SAD risks.
const costPenalty = (costOfLivingIndex: number | null): number => {
  if (costOfLivingIndex == null) return 50; // neutral default, no data
  return clamp(((costOfLivingIndex - 80) / (200 - 80)) * 100);
};

const aqiPenalty = (airQualityIndex: number | null): number => {
  if (airQualityIndex == null) return 50; // neutral default, no data
  return clamp(airQualityIndex);
};

export type CombinedScore = {
  score: number; // 0-100, higher = safer/more livable
  topConcern: RiskFactor;
  recommendation: string;
};

// Single "safety + livability" score, higher is better - inverted from the
// raw risk fields (where higher = worse) because this is meant to answer
// "how good is this city", not just restate the inputs.
export const combinedScore = (city: City): CombinedScore => {
  const sadRisk = sadRiskScore(city);
  const disasterRisk =
    (city.wildfireRisk +
      city.floodRisk +
      city.hurricaneRisk +
      city.heatWaveRisk +
      city.droughtRisk) /
    5;
  const cost = costPenalty(city.costOfLivingIndex);
  const aqi = aqiPenalty(city.airQualityIndex);

  const weightedRisk =
    0.4 * disasterRisk + 0.25 * sadRisk + 0.2 * cost + 0.15 * aqi;
  const score = Math.round(clamp(100 - weightedRisk));

  const factors = riskFactors(city, sadRisk);
  const topConcern = factors.reduce((worst, f) =>
    f.value > worst.value ? f : worst
  );

  const quality =
    score >= 75
      ? 'excellent'
      : score >= 55
        ? 'solid'
        : score >= 35
          ? 'mixed'
          : 'risky';

  const recommendation = `${city.name}, ${city.stateCode} scores ${score}/100 for overall safety and livability — ${quality}, with ${topConcern.label} as the main thing to watch.`;

  return { score, topConcern, recommendation };
};
