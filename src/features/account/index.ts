import { queryOptions } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { deviceSessionsQueryKey } from '@/lib/query-keys';

export { deleteMyAccountFn } from './server/account.mutations';
export { exportMyDataFn } from './server/account.queries';

// authClient.listSessions() is the account-wide session list (better-auth's
// base /list-sessions endpoint) - NOT multiSession.listDeviceSessions(),
// which only enumerates *_multi-* cookies present in the current browser
// and can't show or revoke a session on a different device. This endpoint
// requires a "fresh" session (created within session.freshAge, 24h by
// default - see auth.ts) and throws SESSION_NOT_FRESH otherwise; the query
// surfaces that as a typed error field instead of throwing, so the page can
// show a "sign in again" prompt instead of crashing for any user who logged
// in more than a day ago (the common case, given the 30-day session).
export const accountSessionsQueryOptions = queryOptions({
  queryKey: deviceSessionsQueryKey(),
  queryFn: async () => {
    const result = await authClient.listSessions();
    if (result.error) {
      return {
        sessions: [],
        needsFreshSession: result.error.code === 'SESSION_NOT_FRESH'
      };
    }
    return { sessions: result.data ?? [], needsFreshSession: false };
  }
});
