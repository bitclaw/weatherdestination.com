import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';

const PID_FILE = 'e2e/.server.pid';

export default async function globalSetup() {
  fs.rmSync('e2e/data', { recursive: true, force: true });
  fs.mkdirSync('e2e/data/users', { recursive: true });
  execSync('bun run db:migrate', { stdio: 'inherit' });
  execSync('bun run db:seed', { stdio: 'inherit' });

  if (process.env.CI !== 'true') {
    // Local runs (make e2e.ui) rely on reuseExistingServer for dev-loop
    // convenience instead of the CI path's hard fail below - just warn, since
    // that's a deliberate tradeoff, not a bug to block on.
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
    const { hostname, port } = new URL(baseUrl);
    if (await isPortInUse(Number(port) || 3000, hostname)) {
      console.warn(
        `Port ${port || 3000} is already in use - tests will reuse whatever server is already running there. If that's not your intended target, stop it first.`
      );
    }
    return;
  }

  // Clean up only OUR OWN leftover process from a prior run that didn't tear
  // down cleanly (Playwright can orphan the Vite child on a hard exit) - never
  // a blind kill of whatever happens to be on the port. This used to be
  // `fuser -k 3000/tcp` in the Makefile, unconditionally, before every e2e run;
  // that killed a real, unrelated `make prod.cluster` load-test cluster that
  // happened to be running on :3000. Only ever touch a PID this file itself
  // recorded.
  try {
    const stalePid = Number(fs.readFileSync(PID_FILE, 'utf8'));
    if (stalePid) process.kill(-stalePid, 'SIGKILL');
  } catch {
    // No stale PID file, or process already gone - nothing to clean up.
  } finally {
    fs.rmSync(PID_FILE, { force: true });
  }

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
  const { hostname, port } = new URL(baseUrl);
  const portNum = Number(port) || 3000;

  // If something is already listening here, the server we spawn below will
  // silently fall back to the next free port while this function's own
  // readiness probe keeps polling baseUrl - which the OTHER process answers,
  // not ours. Every test then runs against a wrong, unrelated server with no
  // error at all (this bit us for real: a manually-run `make prod.cluster`
  // on :3000 made an entire e2e run look like a total auth regression, when
  // it was actually just testing the wrong server). Fail loud and immediately
  // instead of ever letting that happen silently.
  if (await isPortInUse(portNum, hostname)) {
    throw new Error(
      `Port ${portNum} is already in use by another process. e2e tests spawn their ` +
        `own isolated server here and will silently test against whatever is already ` +
        `running otherwise, with no error - not a fallback worth trusting. Stop whatever ` +
        `is on :${portNum} (check with \`lsof -i :${portNum}\`) before running e2e.`
    );
  }

  // bun's --bun vite dev buffers ALL TCP connections until the SSR worker connects
  // (~8s). Playwright's built-in webServer health check has no per-request timeout,
  // so any connection made during that window hangs for the full 60s overall timeout.
  // Fix: start the server here and poll with a short per-request timeout. Once the
  // server is actually serving, Playwright runs tests against an already-ready server.
  const server = spawn('bun', ['run', 'dev'], {
    stdio: ['ignore', 'inherit', 'ignore'],
    detached: true,
    env: process.env
  });
  server.unref();
  fs.writeFileSync(PID_FILE, String(server.pid));

  await waitForServer(`${baseUrl}/favicon.ico`);
}

function isPortInUse(port: number, host: string): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host, timeout: 1000 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitForServer(url: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe(url)) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Dev server not ready after ${timeoutMs}ms (${url})`);
}

function probe(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get(url, { timeout: 1500 }, res => {
      resolve(res.statusCode !== undefined && res.statusCode < 400);
      res.resume();
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}
