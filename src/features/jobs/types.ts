// Single source of truth for all background job payloads.
// Keys are dot-namespaced job types, values are typed payloads.
// Rename AppJobs → YourAppJobs if you fork this template.
export type AppJobs = {
  'email:welcome': { userId: string; email: string; name: string | null };
  'email:onboarding-day3': {
    userId: string;
    email: string;
    name: string | null;
  };
  'email:onboarding-day7': {
    userId: string;
    email: string;
    name: string | null;
  };
  'email:trial-expiring': {
    userId: string;
    email: string;
    name: string | null;
    daysLeft: number;
  };
  'email:reengagement': { userId: string; email: string; name: string | null };
  'email:receipt': {
    email: string;
    name: string | null;
    planName: string;
    amount: number;
    currency: string;
  };
  'email:reengagement-scan': Record<string, never>;
  'account:reconcile-deletions': Record<string, never>;
  'analytics:snapshot-mrr': Record<string, never>;
};
