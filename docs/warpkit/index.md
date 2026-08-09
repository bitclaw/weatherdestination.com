# Get Started

Let's get your SaaS in front of customers: fast.

Warpkit is a full-stack TypeScript SaaS starter built on Bun, TanStack Start, and per-user SQLite. Clone it, configure `config.ts`, and ship.

> Everything under `/docs` on this site is rendered straight from the `docs/` folder in the repo you clone, and this page you're reading is `docs/warpkit/index.md` itself. No separate marketing docs to keep in sync, no drift. Point Claude Code, Cursor, or any LLM at your clone and it opens the same context you're reading right now, plus a checked-in `CLAUDE.md` and real Claude Code skills that read like actual conventions, not a wiki nobody kept current.

## What's included

**Auth and billing**
- Passwordless auth: OTP, magic-link, Google, GitHub OAuth
- Email validation: disposable-address + MX checks, pre-submit UX layer plus a hard server-side gate
- Stripe subscriptions, one-time purchases, billing portal, free trial support
- Credits system: per-call metering, Stripe top-up, atomic deduct

**Data and storage**
- Per-user SQLite databases: every user gets their own isolated DB
- S3 file uploads: presigned POST/GET, plan-enforced limits, per-user metadata
- Background jobs: SQLite-backed queue, survives restarts, dead-letter support

**Application features**
- AI chat: SSE streaming via OpenRouter, per-user conversation history
- Apps: static integration card grid at `/dashboard/apps`
- Blog: markdown/JSON post renderer via content-collections
- API keys: hashed, plan-enforced limits, last-used tracking
- In-app notifications: notification bell, mark read, mark all read
- Notification preferences: per-user marketing email toggles
- Sidebar preferences: per-user sidebar item visibility
- Feature requests: user-facing voting board
- Notes: reference CRUD feature (per-user SQLite)
- Audit log: read-only admin event viewer

**Admin and ops**
- Admin panel: user management, impersonation, access control
- Feature flags: DB-backed, admin toggle at runtime, no redeploy needed
- Domain events: typed in-process event bus for side effects
- Durable operations: crash-safe state machine for multi-step cross-system tasks
- GDPR: data export, account deletion state machine

**Frontend and UX**
- Onboarding wizard: multi-step flow, prefetched data, skippable steps
- Cookie consent: GDPR banner, controlled via feature flag
- Analytics: Umami integration, opt-in via env vars
- Captcha: Cloudflare Turnstile, opt-in
- Dark mode and theming
- Landing page components: hero, pricing, FAQ, testimonials, and more

**Infrastructure**
- React Email templates with live preview in dev
- IP-based and per-user DB-backed rate limiting
- Pre-launch lead capture
- Startup/shutdown side effects (job workers, Sentry init, reconciliation): explicit calls in `server/start.ts`, not a Nitro plugin , see `docs/warpkit/features/jobs.md`
- Observability: Sentry error tracking, opt-in via `VITE_SENTRY_DSN`
- Result type: `@bitclaw/result`'s `ok`/`err` , every server function returns one, never throws
- E2E testing: Playwright-based browser tests, ships as source, run locally with `make e2e`

## Prerequisites

- [Bun](https://bun.sh) v1.1+
- A Stripe account (test mode is fine to start)
- A Resend account (or SMTP credentials) for email

## Setup

**1. Clone**

```bash
git clone https://github.com/bitclaw/warpkit my-app
cd my-app
```

**2. Bootstrap**

```bash
make init
```

Copies `.env.example` to `.env`, generates `BETTER_AUTH_SECRET`, installs dependencies, and runs migrations. Safe to re-run (idempotent).

**3. Configure and start**

Fill in `.env` with your Stripe keys, Resend key, and `ADMIN_EMAILS`, then:

```bash
make dev
```

Open [http://localhost:3000](http://localhost:3000). Login at `/login`.

## Next step

Follow the [Ship in 5 minutes](./tutorials/ship-in-5-minutes.md) tutorial to customize and deploy your app.
