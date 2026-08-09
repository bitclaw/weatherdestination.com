import { err, ok } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { ERROR_CODES } from '@/lib/constants';
import { getSetting } from '@/lib/db/settings-helpers.server';
import { getUserDb } from '@/lib/db/user-db';
import { requireUser } from '@/server/require-user';

export const MARKETING_EMAILS_KEY = 'marketing_emails';

// Opt-in default: no row yet (or any value other than '0') means marketing
// emails are on, matching withEmailPreferenceGate's own default.
export const isMarketingEmailsEnabled = (value: string | null): boolean =>
  value !== '0';

export const getNotificationPreferencesFn = createServerFn({
  method: 'GET'
}).handler(async () => {
  const user = await requireUser();
  if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

  const db = getUserDb(user.id);
  const marketingEmails = isMarketingEmailsEnabled(
    getSetting(db, MARKETING_EMAILS_KEY)
  );
  return ok({ marketingEmails });
});
