import { z } from 'zod';

export const FEATURE_REQUEST_STATUSES = [
  'submitted',
  'planned',
  'in_progress',
  'shipped',
  'declined'
] as const;

export const FEATURE_REQUEST_PRIORITIES = [
  'low',
  'medium',
  'high',
  'critical'
] as const;

export const FEATURE_REQUEST_CATEGORIES = [
  'ui_ux',
  'performance',
  'integration',
  'billing',
  'other'
] as const;

export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number];
export type FeatureRequestPriority =
  (typeof FEATURE_REQUEST_PRIORITIES)[number];
export type FeatureRequestCategory =
  (typeof FEATURE_REQUEST_CATEGORIES)[number];

export type FeatureRequestRecord = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: FeatureRequestStatus;
  priority: FeatureRequestPriority;
  category: FeatureRequestCategory;
  createdAt: Date;
  updatedAt: Date | null;
  voteCount: number;
  votedByMe: boolean;
};

// Any authenticated user can submit a request - status/priority are
// triage decisions, set by admins via updateFeatureRequestFn instead (see
// docs/warpkit/features/feature-requests.md).
export const createFeatureRequestSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  category: z.enum(FEATURE_REQUEST_CATEGORIES).optional()
});

// Admin-only: full triage edit.
export const updateFeatureRequestSchema = z.object({
  id: z.string().min(1).max(36),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  status: z.enum(FEATURE_REQUEST_STATUSES).optional(),
  priority: z.enum(FEATURE_REQUEST_PRIORITIES).optional(),
  category: z.enum(FEATURE_REQUEST_CATEGORIES).optional()
});
