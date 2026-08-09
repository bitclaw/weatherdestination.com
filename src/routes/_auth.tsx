import { createFileRoute, redirect } from '@tanstack/react-router';
import { PATHS } from '@/lib/constants';
import { hasSessionCookie } from '@/lib/has-session-cookie';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';
import { AuthLayout } from '@/pages';
import { bootstrapQueryOptions } from '@/server/functions';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context }) => {
    // A visitor with no session cookie is obviously not logged in - skip the
    // real bootstrap/session DB lookup entirely for them, the same trick
    // _landing.index.tsx uses. This is what makes /login and /signup safe to
    // prerender: server/start.ts's PRERENDERED map only serves the static
    // file when no session cookie is present, so a cookie-bearing request
    // still falls through to this beforeLoad and gets the real server-side
    // redirect below - no UX regression for an already-logged-in visitor.
    if (!(await hasSessionCookie())) {
      await setPublicPageCacheHeader();
      return;
    }
    const result = await context.queryClient.ensureQueryData(
      bootstrapQueryOptions
    );
    if (result.ok && result.data.user) {
      throw redirect({ to: PATHS.DASHBOARD });
    }
  },
  component: AuthLayout
});
