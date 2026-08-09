import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.e2e' });

const IS_CI = process.env.CI === 'true';
const cpus = os.cpus().length;
const memGb = os.totalmem() / 1024 ** 3;
const localWorkers = Math.min(cpus, Math.max(1, Math.floor(memGb / 2)));

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  outputDir: './e2e/.tmp/test-results',
  fullyParallel: true,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 2 : localWorkers,
  timeout: 60_000,
  // Default 5s expect() timeout is too tight under full-suite parallel load
  // (2 workers + WSL2 CPU contention) - observed flakes were always correct
  // behavior arriving late (client nav, optimistic-update refetch), never
  // wrong behavior, and never reproduced in isolation. Widen instead of
  // relying on retries to paper over timing, not correctness, failures.
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'e2e/.tmp/playwright-report',
        open: IS_CI
          ? 'never'
          : (process.env.PLAYWRIGHT_OPEN_REPORT ?? 'on-failure')
      }
    ]
  ],
  use: {
    // 127.0.0.1 not localhost: WSL2 Node.js resolves localhost → ::1 (IPv6),
    // but Vite only binds 127.0.0.1, so page.goto calls fail
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  // No webServer block: CI mode starts the server in globalSetup with proper
  // per-request timeouts to avoid the bun SSR buffering hang (see global-setup.ts).
  // Local dev: run `make dev.e2e` before `make e2e.ui`.
  webServer: IS_CI
    ? undefined
    : {
        command: 'bun run dev',
        url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
        reuseExistingServer: true,
        timeout: 5_000
      }
});
