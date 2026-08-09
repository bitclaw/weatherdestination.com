const FLAGS = {
  // Stable features: default ON, opt-out with FEATURE_X=false
  blog: () => process.env.FEATURE_BLOG !== 'false',
  leads: () => process.env.FEATURE_LEADS !== 'false'
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag]();
}
