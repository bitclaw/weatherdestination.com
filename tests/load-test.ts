#!/usr/bin/env bun
/**
 * Application-level load test.
 *
 * Prerequisites:
 *   1. Start the app: make dev
 *   2. Run: bun run test:load [--quick|--public-only]
 *
 * Options:
 *   --url <url>      Base URL (default: http://localhost:3000)
 *   --quick          Quick mode: 5s, concurrency 1/10 only
 *   --public-only    Skip authenticated endpoints
 */
import {
  checkThresholds,
  formatReport,
  loadConfig,
  runAppLoadTest
} from '@bitclaw/loadtest';

const args = process.argv.slice(2);

const urlIdx = args.indexOf('--url');
const isQuick = args.includes('--quick');
const isPublicOnly = args.includes('--public-only');

const config = await loadConfig('warpkit');

if (urlIdx !== -1 && args[urlIdx + 1]) {
  config.baseUrl = args[urlIdx + 1]!;
}

const results = await runAppLoadTest(config, isQuick ? 'quick' : 'full', {
  publicOnly: isPublicOnly
});

process.stdout.write(`\n${formatReport(results, config)}\n`);

const check = checkThresholds(results, config.thresholds);
if (!check.passed) {
  process.exit(1);
}
