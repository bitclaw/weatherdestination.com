import { createFileRoute } from '@tanstack/react-router';
import type { AppRouteContext } from '@/lib/types';
import { AccountPage } from '@/pages/settings/account-page';

// No loader prefetch here, deliberately - accountSessionsQueryOptions'
// queryFn calls authClient.listSessions() (better-auth's browser client
// SDK), which cannot run during SSR: createAuthClient() in auth-client.ts
// has no explicit baseURL, so better-auth's client falls back through
// getBaseURL() -> resolvePublicAuthUrl() (only resolves for Next.js/Vercel
// env vars, none of which apply here) -> the hardcoded relative path
// "/api/auth". A relative fetch() URL resolves fine in a browser (against
// the page's own origin) but throws "fetch() URL is invalid" in a
// window-less SSR context - confirmed directly against
// node_modules/better-auth/dist/client/config.mjs. Prefetching this query
// in the loader (as a previous version of this file did) crashes the whole
// route: the loader runs server-side, the thrown error gets dehydrated into
// the query-stream, and the client re-throws it into this route's
// ErrorBoundary before anything renders - not just this query failing
// silently. Letting it run purely client-side via useSuspenseQuery in
// AccountPage is correct here, not a workaround: this data structurally
// cannot be fetched server-side with this client's current configuration.
export const Route = createFileRoute('/_app/dashboard/settings/account')({
  component: () => {
    const { user } = Route.useRouteContext() as AppRouteContext;
    return <AccountPage user={user} />;
  }
});
