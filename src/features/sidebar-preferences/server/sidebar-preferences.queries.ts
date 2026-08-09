import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { ERROR_CODES } from '@/lib/constants';
import { getSetting } from '@/lib/db/settings-helpers.server';
import { getUserDb } from '@/lib/db/user-db';
import { requireUser } from '@/server/require-user';

export const HIDDEN_SIDEBAR_ITEMS_KEY = 'hidden_sidebar_items';

// Defensive: a corrupted/malformed row (bad JSON, non-array, mixed-type
// array) falls back to "nothing hidden" instead of throwing out of a GET
// handler.
export const parseHiddenUrls = (raw: string | null): string[] => {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return Array.isArray(parsed)
    ? parsed.filter((v): v is string => typeof v === 'string')
    : [];
};

export const getSidebarPreferencesFn = createServerFn({
  method: 'GET'
}).handler(async () => {
  const user = await requireUser();
  if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

  const db = getUserDb(user.id);
  const hiddenUrls = parseHiddenUrls(getSetting(db, HIDDEN_SIDEBAR_ITEMS_KEY));
  return ok({ hiddenUrls });
});
