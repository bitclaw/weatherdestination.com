import type { Job } from '@bitclaw/jobs';

// Shared by the email:* handler test files (email-welcome.test.ts,
// email-onboarding-day3/day7.test.ts, email-reengagement.test.ts,
// email-trial-expiring.test.ts) - each defines its own defaults (payload
// shape differs per job type), but the id/type/cast boilerplate around it
// was hand-rolled independently six times.
export const makeJob = <T>(type: string, data: T): Job<T> =>
  ({ id: 1, type, data }) as Job<T>;
