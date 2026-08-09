import { existsSync, readFileSync } from 'node:fs';
import type { AppLoadTestConfig } from '@bitclaw/loadtest';

const sessionsFile = 'data/loadtest-sessions.json';
const sessionCookies: string[] | undefined = existsSync(sessionsFile)
  ? (JSON.parse(readFileSync(sessionsFile, 'utf-8')) as string[])
  : undefined;

const config: AppLoadTestConfig = {
  appName: 'warpkit',
  baseUrl: process.env.LOADTEST_BASE_URL ?? 'http://localhost:3000',
  productionUrl: 'https://yourdomain.com',

  auth: {
    loginEndpoint: '/api/loadtest/auth',
    emailEnvVar: 'LOADTEST_EMAIL',
    passwordEnvVar: 'LOADTEST_OTP',
    sessionCookieName: 'warpkit.session_token'
  },

  publicEndpoints: [
    { path: '/login', label: 'Login page' },
    { path: '/', label: 'Landing page' }
  ],

  authenticatedEndpoints: [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/dashboard/billing', label: 'Billing' },
    { path: '/dashboard/settings', label: 'Settings' }
  ],

  modes: {
    quick: {
      concurrencyLevels: [1, 10],
      durationSec: 5,
      warmupRequests: 3,
      repeat: 1
    },
    full: {
      concurrencyLevels: [10, 50, 100],
      durationSec: 10,
      warmupRequests: 5,
      repeat: 3
    },
    stress: {
      concurrencyLevels: [50, 100, 200, 500],
      durationSec: 15,
      warmupRequests: 10,
      repeat: 3
    }
  },

  thresholds: {
    p95MaxMs: 500,
    minSuccessRate: 95,
    minThroughput: 50
  },

  sessionCookies
};

export default config;
