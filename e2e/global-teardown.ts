import fs from 'node:fs';

const PID_FILE = 'e2e/.server.pid';

export default async function globalTeardown() {
  if (process.env.CI !== 'true') return;
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8'));
    process.kill(-pid, 'SIGTERM');
    fs.rmSync(PID_FILE, { force: true });
  } catch {
    // Server already gone or PID file missing
  }
}
