import { ErrorBoundary } from '@sentry/tanstackstart-react';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { useEffect, useState } from 'react';
import { CookieConsentBanner } from '@/components/cookie-consent/CookieConsentBanner';
import { CrispChat } from '@/components/crisp-chat';
import { NavigationProgress } from '@/components/navigation-progress';
import { config } from '@/config';
import { installChunkReloadGuard } from '@/lib/chunk-reload-guard';
import { initSentry } from '@/lib/sentry';
import { ErrorPage } from '@/pages/error-pages/error';
import { NotFoundPage } from '@/pages/error-pages/not-found';
import '../styles.css';

if (!import.meta.env.SSR) {
  initSentry();
  installChunkReloadGuard();
}

type RouterContext = {
  queryClient: QueryClient;
};

// Keyed lookups instead of `config.theme.defaultMode === 'dark'` - config's
// `as const satisfies AppConfig` keeps defaultMode narrowed to its literal
// value ('light' here), so an equality check against 'dark' is flagged as
// an impossible comparison even though AppConfig's type is the full union.
//
// Must stay behaviorally identical to useTheme()'s getStoredTheme() default -
// both need to agree on what an unset/first-visit preference resolves to, or
// SSR renders one mode and hydration immediately flips to the other (a
// flash). Baked into the HTML string server-side (not read client-side)
// specifically to avoid that flash: the class has to already be present
// before first paint, which only the SSR-rendered markup can guarantee.
// Each script also paints background/foreground inline, not just the dark
// class or colorScheme: the landing page's critical CSS is inlined at build
// time from a prerender with no dark class present (see
// scripts/inline-critical-css.ts), so the deferred full stylesheet - which
// has the .dark{--background:...} override - isn't loaded yet on first
// paint. Since <body> sets an explicit `background-color: var(--background)`
// (not "no author background"), colorScheme's native paint hint alone
// doesn't help: --background still resolves to its light :root value until
// the deferred stylesheet loads. Setting the literal color directly on
// <html> wins the race unconditionally regardless of any stylesheet's load
// state. Values must match styles.css's :root/.dark --background and
// --foreground - see use-theme.test.ts's sync check.
const THEME_INIT_SCRIPTS: Record<'light' | 'dark', string> = {
  light: `(function(){var t=localStorage.getItem('theme');var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);var h=document.documentElement;if(d){h.classList.add('dark')}h.style.colorScheme=d?'dark':'light';h.style.backgroundColor=d?'oklch(14% 0.025 230)':'oklch(98% 0.005 230)';h.style.color=d?'oklch(93% 0.01 230)':'oklch(14% 0.04 230)'})()`,
  dark: `(function(){var t=localStorage.getItem('theme');var d=t!=='light'&&!(t==='system'&&!matchMedia('(prefers-color-scheme:dark)').matches);var h=document.documentElement;if(d){h.classList.add('dark')}h.style.colorScheme=d?'dark':'light';h.style.backgroundColor=d?'oklch(14% 0.025 230)':'oklch(98% 0.005 230)';h.style.color=d?'oklch(93% 0.01 230)':'oklch(14% 0.04 230)'})()`
};
const themeInitScript: string = THEME_INIT_SCRIPTS[config.theme.defaultMode];

const THEME_COLORS: Record<'light' | 'dark', string> = {
  light: config.theme.lightThemeColor,
  dark: config.theme.darkThemeColor
};
const defaultThemeColor: string = THEME_COLORS[config.theme.defaultMode];

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: defaultThemeColor },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { title: config.seo.defaultTitle },
      { name: 'description', content: config.seo.defaultDescription },
      { property: 'og:title', content: config.seo.defaultTitle },
      { property: 'og:description', content: config.seo.defaultDescription },
      // og:image/twitter:image must be absolute , social crawlers don't
      // resolve relative paths against the page origin.
      {
        property: 'og:image',
        content: `https://${config.domainName}${config.seo.defaultOgImage}`
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: config.seo.defaultTitle },
      { name: 'twitter:description', content: config.seo.defaultDescription },
      {
        name: 'twitter:image',
        content: `https://${config.domainName}${config.seo.defaultOgImage}`
      }
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' },
      {
        rel: 'icon',
        href: '/favicon-32x32.png',
        type: 'image/png',
        sizes: '32x32'
      },
      {
        rel: 'icon',
        href: '/favicon-16x16.png',
        type: 'image/png',
        sizes: '16x16'
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
        sizes: '180x180'
      },
      { rel: 'manifest', href: '/site.webmanifest' },
      // Conditional on the same value gating CrispChat's script below, so
      // this stays correct whenever Crisp is turned on/off - an unused
      // preconnect is a Lighthouse demerit, not a freebie. Umami has no
      // equivalent hint here: its script loads only after cookie consent
      // (see CookieConsentBanner), so a preconnect fired unconditionally on
      // page load would be misleading for the common case of no consent yet.
      ...(config.crisp.id
        ? [{ rel: 'preconnect', href: 'https://client.crisp.chat' }]
        : [])
    ]
  }),
  errorComponent: ({ error, reset }) => (
    <ErrorPage error={error} reset={reset} />
  ),
  notFoundComponent: () => <NotFoundPage />,
  component: RootComponent
});

// Masks the gap between an empty SSR'd document and React's first client
// commit on /_app-scoped routes (ssr: 'data-only' in _app.tsx - no component
// markup is server-rendered there, only data). Genuinely static: rendered
// unconditionally in the raw HTML (no mount-gate, unlike NavigationProgress,
// which deliberately can't appear this early), hidden by a plain mount
// effect once real content has committed in the same pass. Gated on the
// /_app route id (confirmed via routeTree.gen.ts) so it never renders for
// fully-SSR'd public pages, which have no such gap to mask. Complementary to
// _app.tsx's own pendingComponent, not a duplicate - that one covers
// subsequent client-side pending navigations (same "can't appear before
// hydration" limitation as NavigationProgress), this one covers the initial
// pre-hydration gap specifically.
function AppLoadingShell() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(true);
  }, []);

  if (hidden) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static keyframe, no Tailwind utility available pre-stylesheet
        dangerouslySetInnerHTML={{
          __html:
            '@keyframes app-loading-shell-spin{to{transform:rotate(360deg)}}'
        }}
      />
      <svg
        aria-hidden="true"
        style={{
          width: '2rem',
          height: '2rem',
          animation: 'app-loading-shell-spin 1s linear infinite',
          color: 'inherit'
        }}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          style={{ opacity: 0.25 }}
        />
        <path
          d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          fill="currentColor"
          style={{ opacity: 0.75 }}
        />
      </svg>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isAppRoute = useRouterState({
    select: s => s.matches.some(m => m.routeId === '/_app')
  });
  return (
    <QueryClientProvider client={queryClient}>
      <html className="h-full" lang="en" suppressHydrationWarning>
        <head>
          <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: theme init
            dangerouslySetInnerHTML={{ __html: themeInitScript }}
          />
          <HeadContent />
        </head>
        <body className="h-full">
          <NavigationProgress />
          {isAppRoute && <AppLoadingShell />}
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
          <CrispChat />
          <CookieConsentBanner />
          <Scripts />
          {process.env.NODE_ENV === 'development' && (
            <TanStackRouterDevtools position="bottom-right" />
          )}
        </body>
      </html>
    </QueryClientProvider>
  );
}
