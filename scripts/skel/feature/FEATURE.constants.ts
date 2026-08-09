// Types and constants shared between server and client code.
// Import from here in pages , never from *.server.* files (blocked by import protection).

// Theme 5: as const array → derived union type → used in EntityRecord and zod schema.
// EntityRecord.status uses EntityStatus (not string), so form select onChange can cast
// to EntityStatus at the boundary , no repeated union literals at mutation call sites.
import { z } from 'zod';

export const ENTITY_STATUSES = ['active', 'archived'] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

// Shared input schema , used by server mutations (.inputValidator) and client forms (zodValidator).
export const entityInputSchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum(ENTITY_STATUSES).optional()
});

export type EntityRecord = {
  id: string;
  title: string;
  status: EntityStatus;
  created_at: number;
  updated_at: number | null;
};
