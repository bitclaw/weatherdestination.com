# Multi-stage build. server/start.ts (the production entry point, see
# CLAUDE.md's "Server Boot Side Effects") is run directly by Bun rather than
# bundled - it dynamically imports from @/lib/db, @/features/jobs/workers,
# etc. at runtime - so the runtime image ships the app source alongside
# dist/, not dist/ alone. This mirrors exactly what `bun run build && bun run
# start` does locally (the tested, CI-verified path); this Dockerfile only
# adds multi-stage layering, a non-root user, and a healthcheck on top of
# that same flow.

# Pinned by digest, not the floating `1-alpine` tag - a tag push silently
# changes the base of every future build with no lockfile-equivalent to
# catch it, defeating build reproducibility. Bump deliberately (e.g. via
# Renovate, which this repo already uses for npm deps) rather than picking
# up a new base image on every rebuild.
FROM oven/bun:1-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS build
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

# `vite build`'s prerender step boots a real server instance (to crawl `/`),
# which constructs the real auth/billing/email clients - better-auth throws
# on a missing/default BETTER_AUTH_SECRET regardless of NODE_ENV, and this
# repo's own production-only boot checks (src/start.ts) would otherwise
# require real STRIPE_SECRET_KEY/RESEND_API_KEY/ADMIN_EMAILS just to bundle
# static assets. Those checks skip during the prerender crawl specifically
# (process.env.TSS_PRERENDERING === 'true', set by the prerender step
# itself - see src/start.ts), not by lying about NODE_ENV: Vite/Rollup
# resolves and dead-code-eliminates every process.env.NODE_ENV==='production'
# branch in the bundle at build time, so building under NODE_ENV=test used
# to permanently freeze rate limiting, HSTS, CSP, and the secure cookie
# prefix off in the shipped artifact regardless of the container's real
# runtime NODE_ENV. Build under the real value instead. A placeholder secret
# is still required here regardless of NODE_ENV; real secrets are supplied
# at `docker run` time, not build time.
ENV NODE_ENV=production
ENV BETTER_AUTH_SECRET=docker-build-placeholder-not-used-at-runtime
RUN bun run build

FROM oven/bun:1-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S warpkit && adduser -S warpkit -G warpkit

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production

COPY --from=build /app/dist ./dist
COPY --from=build /app/.content-collections ./.content-collections
COPY server ./server
COPY src ./src
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY public ./public
COPY config.ts tsconfig.json cluster.ts ./

# DATABASE_PATH/USER_DATA_DIR/JOBS_DB_PATH all default under ./data (see
# .env.example) - mount a volume at /app/data for persistence. Only /app/data
# is writable by the runtime user: app code stays root-owned and read-only to
# warpkit, so an RCE/arbitrary-file-write bug in the app can't rewrite its own
# source to persist across a container restart.
RUN mkdir -p data && chown -R warpkit:warpkit /app/data

USER warpkit
EXPOSE 3000

# server/start.ts serves the prerendered `/` page before touching SSR (see
# server/start.ts's fetch handler), so an anonymous GET / is a real,
# always-200 signal that the process is actually accepting connections -
# no separate health endpoint needed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT ?? 3000) + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "server/start.ts"]
