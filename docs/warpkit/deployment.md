# Deployment

Warpkit is a Bun + TanStack Start app. It runs as a long-lived server process, so any host that supports persistent processes works.

## Build

```bash
bun run build
```

Output:
- `dist/client/` , static assets + prerendered HTML files
- `dist/server/server.js` , SSR fetch handler (Bun-compatible)

## Start

```bash
bun run start
```

Runs `server/start.ts` , a thin Bun wrapper that serves prerendered HTML files statically before delegating to the SSR handler. The landing page (`/`) is served from `dist/client/index.html` without touching the SSR process.

To test the production build locally (matches CDN behavior for prerendered routes):

```bash
make prod   # build + start
```

## Environment variables

Set all production values before deploying. At minimum:

```bash
DATABASE_PATH=/data/meta.db         # path to shared SQLite file
BETTER_AUTH_SECRET=<32-char-secret>
BETTER_AUTH_URL=https://myapp.com

RESEND_API_KEY=re_...

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PRO_PRICE_ID=price_...
VITE_STRIPE_PRO_YEARLY_PRICE_ID=price_...

ADMIN_EMAILS=you@myapp.com
```

## Data persistence

Warpkit writes to disk:

- `DATABASE_PATH` path: shared app SQLite (users, sessions, subscriptions)
- `data/users/`: per-user SQLite files

Both paths must be on a persistent volume, not ephemeral storage.

## Hetzner VPS + Caddy (recommended for self-hosting)

Run Caddy as a reverse proxy in front of Bun. Caddy handles TLS, serves static assets directly from disk, and forwards everything else to the Bun process.

**Caddyfile** (`/etc/caddy/Caddyfile`):

```caddyfile
myapp.com {
    # Serve immutable hashed assets directly from disk , bypasses Bun entirely.
    # Caddy decompresses brotli/gzip automatically if the client supports it.
    handle /assets/* {
        root * /app/dist/client
        file_server {
            precompressed br gzip
        }
        header Cache-Control "public, max-age=31536000, immutable"
    }

    # Everything else proxies to Bun (SSR + API routes).
    handle {
        reverse_proxy localhost:3000
    }

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }

    encode gzip

    log {
        output file /var/log/caddy/myapp.log
    }
}
```

**Deploy steps:**

1. Build on CI or locally, copy `dist/` to the server
2. Start the Bun process: `PORT=3000 bun server/start.ts`
3. Reload Caddy: `caddy reload`

For zero-downtime restarts, run Bun under `systemd` and use `systemctl restart myapp` after deploying.

**systemd unit** (`/etc/systemd/system/myapp.service`):

```ini
[Unit]
Description=warpkit app
After=network.target

[Service]
WorkingDirectory=/app
ExecStart=/usr/local/bin/bun server/start.ts
Restart=always
RestartSec=5
EnvironmentFile=/app/.env
User=www-data

[Install]
WantedBy=multi-user.target
```

`/app/.env` should be `chown root:root` / `chmod 600` , the unit runs as
`www-data`, which only needs to *read* it via `EnvironmentFile`, not own it,
and `/app` itself is the app's working directory (writable by the deploy
process), not a place secrets should be group/world-readable by default.

## Fly.io

1. `fly launch`: auto-detects Bun
2. Attach a persistent volume and mount it at `/data`
3. Set `DATABASE_PATH=/data/meta.db`
4. Set all other env vars with `fly secrets set`

```bash
fly secrets set BETTER_AUTH_SECRET=... RESEND_API_KEY=... STRIPE_SECRET_KEY=...
```

## Railway

1. Deploy from GitHub
2. Add a volume, mount at `/data`
3. Set env vars in the Railway dashboard

## Docker

See the repo-root `Dockerfile` , multi-stage (build stage produces `dist/`,
runtime stage installs production-only deps), runs as a non-root user, and
has a `HEALTHCHECK` against `GET /` (server/start.ts serves the prerendered
landing page before touching SSR, so an anonymous request there is a real
liveness signal).

```bash
docker build -t warpkit .
docker run -d -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file /path/to/production.env \
  warpkit
```

Use `--env-file`, not `-e KEY=value` on the command line , CLI-supplied env
vars land in shell history, are readable via `docker inspect` by anyone in
the `docker` group, and are exposed at `/proc/<pid>/environ`. `production.env`
should be root-owned, `chmod 600`, and never committed (same rule as `.env`).
It needs at least `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`,
`RESEND_API_KEY`, and `ADMIN_EMAILS` , see `.env.example` for the full list.

Mount a volume at `/app/data` for persistence (`DATABASE_PATH`,
`USER_DATA_DIR`, `JOBS_DB_PATH` all default under there , see
`.env.example`). Run `bun run db:migrate` (and `bun run db:seed` if needed)
against that volume before first boot, same as any non-Docker deploy.

Real secrets are only needed at `docker run` time, not `docker build` time ,
the build stage's `vite build` triggers prerendering, which boots a real
server instance and would otherwise require production secrets just to
bundle static assets. The Dockerfile sidesteps this with a build-only
`NODE_ENV=test` + placeholder `BETTER_AUTH_SECRET`, mirroring what `make ci`
already does via a local (gitignored, never-baked-into-the-image) `.env`
file.

## Stripe webhooks

After deploying, register your webhook URL in the Stripe dashboard:

```
https://myapp.com/api/v1/stripe-webhook
```

Events to enable: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`, `charge.refunded`, `charge.dispute.created`. Under-registering `charge.refunded` or `charge.dispute.created` silently breaks refund/dispute access revocation , see `docs/warpkit/features/billing.md` for the full event table.

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.
