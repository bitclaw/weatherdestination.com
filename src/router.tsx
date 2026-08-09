import { QueryClient } from '@tanstack/react-query';
import { createRouter as createTanstackRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000
      }
    }
  });

  const router = createTanstackRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultStaleTime: 30_000,
    scrollRestoration: true
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

export type AppRouter = ReturnType<typeof getRouter>;

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: interface needed for declaration merging
  interface Register {
    router: AppRouter;
  }
}
