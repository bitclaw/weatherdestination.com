import { availableParallelism } from 'node:os';

const WORKER_COUNT = availableParallelism();
const PORT = process.env.PORT ?? '3000';

const workers = new Set<ReturnType<typeof Bun.spawn>>();
let shuttingDown = false;

function spawnWorker() {
  const proc = Bun.spawn([process.execPath, 'server/start.ts'], {
    env: process.env as Record<string, string>,
    stdout: 'inherit',
    stderr: 'inherit'
  });

  workers.add(proc);

  void proc.exited.then(code => {
    workers.delete(proc);
    if (shuttingDown) return;
    console.info(
      `Worker ${String(proc.pid)} exited (${String(code)}), restarting...`
    );
    spawnWorker();
  });
}

console.info(`Starting ${String(WORKER_COUNT)} workers on port ${PORT}...`);

for (let i = 0; i < WORKER_COUNT; i++) {
  spawnWorker();
}

const shutdown = () => {
  shuttingDown = true;

  const killPromises = [...workers].map(worker => {
    worker.kill();
    return worker.exited;
  });

  const forceKill = setTimeout(() => {
    for (const worker of workers) {
      try {
        worker.kill('SIGKILL');
      } catch {}
    }
  }, 8000);

  void Promise.allSettled(killPromises).then(() => {
    clearTimeout(forceKill);
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
