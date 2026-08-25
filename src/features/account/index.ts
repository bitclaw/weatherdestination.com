import { queryOptions } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { deviceSessionsQueryKey } from '@/lib/query-keys';

export { TwoFactorSection } from './components/two-factor-section';
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
// CLIENT-ONLY - do not prefetch this via ensureQueryData()/prefetchQuery()
// in a route loader. queryFn calls authClient.listSessions() (better-auth's
// browser client SDK), which has no explicit baseURL (see auth-client.ts)
// and falls back to a relative "/api/auth" path - that resolves fine in a
// browser (against the page's own origin) but throws "fetch() URL is
// invalid" in a window-less SSR context (loaders run server-side). A
// prefetch attempt doesn't just fail this query - the thrown error gets
// dehydrated into the query stream and the client re-throws it into the
// route's ErrorBoundary before ANYTHING on the page renders. Confirmed
// directly against node_modules/better-auth/dist/client/config.mjs; this
// bit _app.dashboard.settings.account.tsx in production, see that route
// file's own comment for the fix. Let this run purely client-side via
// useSuspenseQuery instead - there is no safe way to prefetch it as things
// stand today.
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
