import { execSync } from 'node:child_process';
import contentCollections from '@content-collections/vite';
import babel from '@rolldown/plugin-babel';
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

// Baked into both the client and SSR bundles at build time (a single Vite
// build produces one matched pair, so the constant is identical everywhere
// the same build's code runs) - powers the update-available banner's
// version check without any runtime env var injection, unlike a per-boot
// deploy-time RELOAD_ID. Prefers a short git SHA for a human-meaningful
// value; must fall back to a timestamp, not throw - .dockerignore excludes
// .git from the documented Docker build context, so `git rev-parse` fails
// there specifically, not just hypothetically in some unknown environment.
function resolveBuildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();
  } catch {
    return String(Date.now());
  }
}
const buildId = resolveBuildId();

// @tanstack/* and seroval-plugins ship ESM with sourceMappingURL comments
// referencing .map files not included in their npm release. Vite logs
// ENOENT for each one on every dev reload, noise we cannot fix upstream.
// Our own source maps are unaffected: dev uses inline maps, prod uses
// sentryTanstackStart which generates, uploads, and deletes .map files.
const logger = createLogger();
const originalWarn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
  if (msg.includes('Failed to load source map') && msg.includes('node_modules'))
    return;
  originalWarn(msg, options);
};

export default defineConfig({
  customLogger: logger,
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId)
  },
  resolve: {
    tsconfigPaths: true
  },
  optimizeDeps: {
    exclude: ['bun', 'bun:sqlite']
  },
  plugins: [
    contentCollections(),
    tailwindcss(),
    tanstackStart({
      // See docs/warpkit/features/static-prerendering.md for the full
      // picture (this option + server/start.ts's PRERENDERED map together).
      prerender: {
        enabled: true,
        // Allowlist, not a denylist: every route the router-generator finds
        // (dashboard, settings, admin, etc.) is a *candidate* via
        // autoStaticPathsDiscovery (default true), but only public,
        // non-personalized marketing/legal/blog/auth-entry pages belong
        // here. login/signup qualify only because _auth.tsx's beforeLoad
        // gates its DB-backed redirect check behind hasSessionCookie() -
        // server/start.ts's cookie check still routes a logged-in visitor
        // to real SSR, never the static file. Never widen this to something
        // permissive like "not under _app" - a route with no `$param` but
        // auth-gated content (there are none today, but nothing stops one
        // being added) would get its personalized-for-nobody-in-particular
        // HTML baked in at build time and served to every visitor.
        filter: page =>
          page.path === '/' ||
          page.path === '/pricing' ||
          page.path === '/features' ||
          page.path === '/changelog' ||
          page.path === '/contact' ||
          page.path === '/privacy' ||
          page.path === '/tos' ||
          page.path === '/login' ||
          page.path === '/signup' ||
          page.path === '/blog' ||
          page.path.startsWith('/blog/'),
        // Blog post pages are dynamic (/blog/$slug) so autoStaticPathsDiscovery
        // skips them; crawlLinks finds them by parsing <a href> out of the
        // rendered /blog index instead, no manual slug list to keep in sync.
        crawlLinks: true
        // Cache-Control for the prerendered HTML is NOT set here - a
        // `headers` option here has no effect on the real response (these
        // paths are served via Bun.file() in server/start.ts, which sets its
        // own header, bypassing this plugin's output entirely). The one real
        // source of truth is LANDING_PAGE_CACHE_CONTROL in
        // src/lib/ssr-cache-headers.ts.
      },
      router: {
        routeFileIgnorePattern: '\\.(test|spec)\\.(ts|tsx)$'
      },
      importProtection: {
        client: {
          // src/lib/db uses bun:sqlite and drizzle , runtime crash if bundled client-side.
          // Must include the default pattern since `files` replaces defaults.
          // Note: src/server/** is intentionally excluded: *.functions.ts files are
          // createServerFn RPC stubs that must be importable from routes/components.
          files: ['**/*.server.*', '**/lib/db/**']
        }
      }
    }),
    sentryTanstackStart({
      reactComponentAnnotation: { enabled: true }
    }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()], exclude: /node_modules/ })
  ],
  build: {
    // TanStack Start's Vite plugin synthesizes the client entry as a virtual
    // module that statically pulls in the framework's router/start runtime
    // (and, transitively, other @tanstack/* packages like react-query) -
    // this happens before Rollup's per-module manualChunks resolution ever
    // sees individual node_modules/@tanstack/* file boundaries, so a
    // `manualChunks` rule matching '@tanstack/' can never fire for any of
    // it. Confirmed via a real build: no vendor-tanstack-*.js chunk is ever
    // produced, so that rule was removed rather than left as dead config
    // someone might try to "fix" again. 392 KB gzip is the framework cost;
    // individual routes are already lazy-loaded (< 1 KB each).
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // nodemailer is server-only. API route files (lead.ts) statically import
      // email.ts at the top level so TanStack Router's route-tree scanner pulls
      // it into the client build graph. Marking it external stops Vite from
      // bundling its Node.js built-ins into client chunks.
      // IMPORTANT: rollupOptions.external is production-build only. The Vite dev
      // server does NOT respect it. For any server-only package imported at the
      // top level of a createServerFn file, use a dynamic import inside the handler
      // body instead , that is the only fix that works in both dev and prod.
      external: ['nodemailer', 'bun', 'bun:sqlite'],
      onwarn(warning, warn) {
        // TanStack packages import symbols that Rollup flags as unused in SSR analysis.
        // TanStackRouterDevtools warning is a false positive: it is rendered in JSX
        // at __root.tsx:93 but the SSR tree-shaker can't see JSX usage.
        if (
          warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
          (warning.exporter?.includes('@tanstack/') ||
            warning.exporter?.includes('@tanstack/react-router-devtools'))
        ) {
          return;
        }
        // A server-only module (bun:*, node:*) leaking into the client bundle causes
        // esbuild to hang silently during chunk output. Fail loud here instead.
        if (
          warning.message?.includes(
            'has been externalized for browser compatibility'
          )
        ) {
          throw new Error(
            `Server module in client bundle , add it to rollupOptions.external or fix the import chain.\n${warning.message}`
          );
        }
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
          // Per-package, not one monolithic 'vendor-radix' chunk: grouping
          // every radix primitive into a single chunk means using even one
          // (e.g. Tooltip, needed on every authenticated page) forces every
          // page that loads it to also fetch every OTHER primitive's code
          // (Select, Dialog, DropdownMenu, Tabs, ...) whether that page uses
          // them or not. Splitting per npm package lets a page's actual
          // import graph determine what it preloads; shared low-level
          // packages (@radix-ui/react-primitive, -context, -compose-refs,
          // etc.) get their own small chunk too, loaded once and reused by
          // whichever primitive-specific chunks need them. Confirmed to
          // matter on runmist (a downstream fork of this template) only
          // once combined with eliminating the @/components/ui barrel
          // import - see that commit for the measured numbers.
          const radixMatch = id.match(
            /\/node_modules\/@radix-ui\/react-([a-z-]+)\//
          );
          if (radixMatch) {
            return `vendor-radix-${radixMatch[1]}`;
          }
          if (id.includes('/node_modules/radix-ui/')) {
            return 'vendor-radix-core';
          }
          if (id.includes('/node_modules/lucide-react/')) {
            return 'vendor-lucide';
          }
          if (id.includes('/node_modules/motion-plus')) {
            // Separate chunk from core 'motion': motion-plus (AnimateNumber)
            // is only used by the lazy-loaded pricing section. Merging it
            // into vendor-motion below would force its ~29KB into the
            // eagerly-loaded initial bundle even though nothing needs it
            // until the pricing section's own lazy chunk loads.
            return 'vendor-motion-plus';
          }
          if (id.includes('/node_modules/motion/')) {
            return 'vendor-motion';
          }
        }
      }
    }
  },
  server: {
    port: 3000
  }
});
