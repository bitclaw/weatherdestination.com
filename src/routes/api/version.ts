import { createFileRoute } from '@tanstack/react-router';

// Polled by use-update-available.ts to detect a newer build than the one
// that rendered the current session's app shell. VITE_BUILD_ID is baked in
// at build time (see vite.config.ts) - identical for the client bundle and
// this SSR route within a single build, so no runtime env var plumbing is
// needed. Public, cheap, no DB/auth - same spirit as /healthcheck.
export const Route = createFileRoute('/api/version')({
  server: {
    handlers: {
      GET: () =>
        Response.json({ buildId: import.meta.env.VITE_BUILD_ID ?? 'dev' })
    }
  }
});
