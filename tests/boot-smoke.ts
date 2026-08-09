#!/usr/bin/env bun
/**
 * Boots the real production server entry point (server/start.ts) as a real
 * subprocess and verifies job workers actually start and the process shuts
 * down cleanly on SIGTERM.
 *
 * This exists because server/plugins/*.ts (Nitro plugins) used to look like
 * they wired up startup/shutdown, but never actually ran in dev, in
 * `bun run build`, or in the built bundle - nothing in the test suite ever
 * booted the real production entry point, so the bug shipped invisibly. See
 * docs/warpkit/features/jobs.md's "Why server/start.ts, not a Nitro plugin".
 *
 * Prerequisites: `NODE_ENV=production bun run build` (dist/server/server.js
 * must exist). Run via `make check-boot` / `bun tests/boot-smoke.ts`.
 *
 * Also asserts real response headers (HSTS, X-Frame-Options, CSP) on both
 * the SSR path and the prerendered-HTML/static-asset fast paths in
 * server/start.ts - this is the one check that would have caught the
 * NODE_ENV=test-baked-into-the-build bug (every process.env.NODE_ENV
 * === 'production' branch statically frozen out of the bundle at build
 * time), since everything else in the CI pipeline is either static analysis
 * or a real request against a dev-mode Vite server, neither of which
 * exercises the built artifact's actual runtime behavior.
 */
import path from 'node:path';

const { SESSION_COOKIE_NAME } = await import(
  path.resolve(import.meta.dirname, '..', 'config.ts')
);

const BOOT_TIMEOUT_MS = 15_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const PORT = '3999';

const distServer = path.resolve(
  import.meta.dirname,
  '..',
  'dist',
  'server',
  'server.js'
);

if (!(await Bun.file(distServer).exists())) {
  console.error(
    `❌ ${distServer} missing - run 'NODE_ENV=production bun run build' first`
  );
  process.exit(1);
}

const proc = Bun.spawn(['bun', '--env-file=.env.test', 'server/start.ts'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: {
    PATH: process.env.PATH ?? '',
    // Must match the build's NODE_ENV: the checks and header logic this
    // process runs were resolved into the bundle at build time (see the
    // header comment above), so running the spawned process under a
    // different NODE_ENV than it was built with doesn't change its actual
    // behavior - it would only make this smoke test misleadingly pass or
    // fail against something other than what a real deploy runs.
    NODE_ENV: 'production',
    PORT,
    LOG_LEVEL: 'info'
  },
  stdout: 'pipe',
  stderr: 'pipe'
});

let stdout = '';
let stderr = '';
let sawWorkersStarted = false;
let sawDeletionReconcile = false;
let sawBillingReconcile = false;

// account-deletion.server.ts / billing-reconciliation.server.ts are loaded
// via a fire-and-forget dynamic import() in server/start.ts (deliberately
// not awaited, so a slow Stripe call can't block boot) - the same shape as
// the dead server/plugins/ bug this smoke test exists to catch (something
// wired up but never verified to actually run). server/start.ts always logs
// a completion line for both regardless of whether they found anything to
// reconcile, specifically so this test can assert the import chain actually
// executed and didn't throw at module-load time, not just that job workers
// started.
const matchesLog = (line: string, substrings: string[]): boolean => {
  try {
    const parsed = JSON.parse(line) as { msg?: string };
    return substrings.every(s => parsed.msg?.includes(s));
  } catch {
    return false; // Non-JSON line (e.g. "Server running at ..."), ignore.
  }
};

// Both streams are drained continuously for the process's entire lifetime,
// not just until the worker-start line is seen - the child keeps emitting
// reconciliation log lines afterward (potentially hundreds, one per seeded
// row), and an undrained pipe fills its OS buffer, blocking the child's
// writes and preventing its SIGTERM handler from ever running before the
// runtime's default signal disposition kills it. Draining stops on its own
// once the streams close, which happens when the process actually exits.
const drainStdout = (async () => {
  for await (const chunk of proc.stdout) {
    stdout += Buffer.from(chunk).toString();
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      if (matchesLog(line, ['Started', 'workers'])) sawWorkersStarted = true;
      if (matchesLog(line, ['account deletion reconcile'])) {
        sawDeletionReconcile = true;
      }
      if (matchesLog(line, ['billing reconcile'])) sawBillingReconcile = true;
    }
  }
})();

const drainStderr = (async () => {
  for await (const chunk of proc.stderr) {
    stderr += Buffer.from(chunk).toString();
  }
})();

const waitFor = async (
  predicate: () => boolean,
  timeoutMs: number
): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) return false;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return true;
};

const dumpOutput = () => {
  console.error(`--- stdout ---\n${stdout}`);
  console.error(`--- stderr ---\n${stderr}`);
};

const booted = await waitFor(() => sawWorkersStarted, BOOT_TIMEOUT_MS);

if (!booted) {
  console.error('❌ Job workers never started within timeout.');
  dumpOutput();
  proc.kill('SIGKILL');
  process.exit(1);
}

console.info('✓ Job workers started');

const reconciled = await waitFor(
  () => sawDeletionReconcile && sawBillingReconcile,
  BOOT_TIMEOUT_MS
);

if (!reconciled) {
  console.error(
    '❌ Fire-and-forget reconcilers (account deletion / billing) never completed within timeout - the dynamic import() in server/start.ts may be throwing at module-load time.'
  );
  dumpOutput();
  proc.kill('SIGKILL');
  process.exit(1);
}

console.info('✓ Startup reconcilers ran');

// Real HTTP requests against the booted server, not static analysis - the
// prerendered-HTML path, a static asset, and the SSR fallback each build
// their response headers differently (see server/start.ts and
// src/server/csp.ts's applySecurityHeaders), so all three are checked.
const assertSecurityHeaders = async (
  label: string,
  url: string,
  init?: RequestInit
): Promise<void> => {
  const res = await fetch(url, init);
  const hsts = res.headers.get('Strict-Transport-Security');
  const frameOptions = res.headers.get('X-Frame-Options');
  const csp = res.headers.get('Content-Security-Policy') ?? '';

  const failures: string[] = [];
  if (!hsts) failures.push('missing Strict-Transport-Security');
  if (frameOptions !== 'DENY') {
    failures.push(`X-Frame-Options is '${frameOptions}', expected 'DENY'`);
  }
  if (!csp.includes('frame-ancestors')) {
    failures.push('CSP missing frame-ancestors directive');
  }
  if (csp.includes('unsafe-eval')) {
    failures.push("CSP contains 'unsafe-eval' (dev-only directive)");
  }

  if (failures.length > 0) {
    console.error(`❌ ${label} (${url}): ${failures.join('; ')}`);
    dumpOutput();
    proc.kill('SIGKILL');
    process.exit(1);
  }
};

await assertSecurityHeaders('prerendered path', `http://localhost:${PORT}/`);

const assetsDir = path.resolve(
  import.meta.dirname,
  '..',
  'dist',
  'client',
  'assets'
);
const glob = new Bun.Glob('*.js');
const firstAsset = (await Array.fromAsync(glob.scan({ cwd: assetsDir })))[0];
if (firstAsset) {
  await assertSecurityHeaders(
    'static asset',
    `http://localhost:${PORT}/assets/${firstAsset}`
  );
} else {
  console.error(`❌ No .js assets found in ${assetsDir} to check`);
  proc.kill('SIGKILL');
  process.exit(1);
}

// A fake session cookie forces server/start.ts past its prerendered-HTML
// fast path for /changelog (a normally-prerendered route) into the real
// ssr.fetch() handler, so this exercises requestMiddleware's
// securityMiddleware specifically, not the fast path already checked above.
await assertSecurityHeaders(
  'SSR-rendered response',
  `http://localhost:${PORT}/changelog`,
  { headers: { cookie: `${SESSION_COOKIE_NAME}=fake` } }
);

// A thrown redirect() (anonymous /dashboard -> /login) and the router's
// not-found handling both build their own Response outside the normal
// resolved-route path, which used to bypass requestMiddleware's header
// application entirely - confirmed via manual curl. server/start.ts now
// re-applies headers unconditionally on whatever ssr.fetch() returns,
// closing that gap; assert it holds for both response shapes.
await assertSecurityHeaders(
  'SSR redirect (/dashboard -> /login)',
  `http://localhost:${PORT}/dashboard`,
  { redirect: 'manual' }
);

await assertSecurityHeaders(
  'SSR not-found',
  `http://localhost:${PORT}/this-route-does-not-exist`
);

console.info('✓ Security headers present on prerendered/static/SSR paths');

proc.kill('SIGTERM');

let exited = false;
void proc.exited.then(() => {
  exited = true;
});

const shutdownClean = await waitFor(() => exited, SHUTDOWN_TIMEOUT_MS);

if (!shutdownClean) {
  console.error(
    `❌ Server did not exit within ${SHUTDOWN_TIMEOUT_MS}ms of SIGTERM - shutdown hook is hung or missing.`
  );
  dumpOutput();
  proc.kill('SIGKILL');
  process.exit(1);
}

const exitCode = await proc.exited;
if (exitCode !== 0) {
  console.error(
    `❌ Server exited with unexpected code ${exitCode} after SIGTERM.`
  );
  dumpOutput();
  process.exit(1);
}

await Promise.all([drainStdout, drainStderr]);

console.info('✓ Clean shutdown on SIGTERM');
console.info('✓ boot-smoke passed');
