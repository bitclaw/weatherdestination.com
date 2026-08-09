# E2E Testing

Playwright-based browser tests for local development. Not wired into CI , these validate full user flows that unit tests can't cover.

## Prerequisites

- Server running: `make dev` or `make prod`
- `.env.e2e` configured (see setup below)
- Chromium installed: `bunx playwright install chromium`

## Setup

`.env.e2e` is committed with default test credentials matching the load test defaults. No setup needed unless you changed `LOADTEST_EMAIL` / `LOADTEST_OTP` in your `.env`.

The auth tests use `/api/loadtest/auth` to create a session without the OTP email flow. That endpoint must be enabled in `.env`:

```bash
LOADTEST_AUTH_ENABLED=true
LOADTEST_EMAIL=loadtest@example.com
LOADTEST_OTP=loadtest123
```

## Running tests

```bash
make dev          # terminal 1 , or make prod
make e2e          # terminal 2 , run all tests headless (both browsers)
make e2e.ui       # terminal 2 , headed Chromium (watch tests run)
make e2e.webkit   # terminal 2 , headed WebKit/Safari
make e2e.report   # open last HTML report
```

`make e2e.ui` and `make e2e.webkit` open a real browser window so you can watch tests execute. Useful for debugging failures visually.

## Test structure

```
e2e/
├── playwright.config.ts    -- at project root
├── helpers/
│   └── auth.ts             -- loginAsTestUser()
├── fixtures/
│   └── users.ts            -- TEST_USER from env vars
└── tests/
    ├── smoke.spec.ts       -- no auth required (landing, redirects, login page)
    └── auth/
        └── login.spec.ts   -- authenticated flows (skipped without .env.e2e)
```

## Auth in tests

`loginAsTestUser(page)` from `e2e/helpers/auth.ts`:

1. POSTs to `/api/loadtest/auth` with credentials from env
2. Extracts the `Set-Cookie` header and applies it to the page context
3. Navigates to `/dashboard` to warm up the per-user SQLite DB (first access runs migrations , 1-2s)

Auth tests are skipped automatically when `LOADTEST_AUTH_ENABLED` is not set, so `make e2e` still works without credentials (smoke tests run, auth tests skip).

## Workers

Playwright detects available CPU and memory and sets worker count automatically:

```ts
const localWorkers = Math.min(cpus, Math.max(1, Math.floor(memGb / 2)));
```

One worker per 2GB of RAM, capped at CPU count. No manual tuning needed.

## WSL2 note

Playwright's health checks use Node.js HTTP which resolves `localhost` to `::1` (IPv6) on WSL2. Vite only binds `127.0.0.1`. Config uses `http://127.0.0.1:3000` explicitly to avoid connection timeouts.
