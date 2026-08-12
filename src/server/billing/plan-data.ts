// Pure data - no server imports, no process.env. Safe for client and server.
import type { AppConfig } from '../../../config';

export type TrialCopy = {
  actionLabel: string;
  sentence: string;
};

// Single source of truth for trial-related copy, driven by
// config.billing.trialDays/noCardTrial instead of each call site hardcoding
// its own claim. Returns null when no trial is configured, so callers can
// hide trial-specific copy entirely rather than reword it.
export function getTrialCopy(billing: AppConfig['billing']): TrialCopy | null {
  if (!billing.trialDays) return null;

  const days = billing.trialDays;
  if (billing.noCardTrial) {
    return {
      actionLabel: 'Start Free Trial',
      sentence: `${days}-day free trial. No credit card required.`
    };
  }

  return {
    actionLabel: 'Start Free Trial',
    sentence: `${days}-day free trial. Card required after trial ends.`
  };
}
