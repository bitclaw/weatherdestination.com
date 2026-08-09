import { z } from 'zod';

export type NoteRecord = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  created_at: number;
  updated_at: number;
};

export const noteInputSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(50_000).optional()
});

export const noteUpdateSchema = noteInputSchema.extend({
  id: z.string().min(1).max(36)
});
