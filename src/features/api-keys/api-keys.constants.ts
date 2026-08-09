import { z } from 'zod';

export const API_KEY_STATUSES = ['active', 'revoked'] as const;
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number];

export type ApiKeyRecord = {
  id: string;
  name: string;
  keyPreview: string;
  status: ApiKeyStatus;
  last_used_at: number | null;
  created_at: number;
};

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100)
});
