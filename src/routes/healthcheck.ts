import { createFileRoute } from '@tanstack/react-router';

// Caddy's reverse_proxy active health check (health_uri /healthcheck in the
// deploy template) hits this with no fallback path, unlike redeploy.sh's own
// zero-downtime readiness check, which falls back to / if this 404s. Without
// this route the app deploys "successfully" (readiness check passes via the
// fallback) but Caddy considers every upstream permanently unhealthy and
// returns 503 for all real traffic.
export const Route = createFileRoute('/healthcheck')({
  server: {
    handlers: {
      GET: () => new Response('ok', { status: 200 })
    }
  }
});
