# Background Jobs

warpkit uses [`@bitclaw/jobs`](https://www.npmjs.com/package/@bitclaw/jobs) , a SQLite-backed background job queue built for single-instance Bun apps.

## Architecture

```
enqueue('email:welcome', { email, name })
         │
         ▼
   data/jobs.db   ←── persisted immediately (synchronous SQLite write)
         │
         ▼
   Worker (polling every 1s)
         │
         ├── success → job deleted from queue
         └── failure → retry up to maxRetries → dead-letter table
```

- **Queue DB**: `data/jobs.db` (separate from the shared app DB and per-user DBs)
- **Workers start** on server boot via `server/start.ts` (`startWorkers()`) , see "Why server/start.ts, not a Nitro plugin" below
- **Workers stop** gracefully on `SIGTERM`/`SIGINT` via the same file
- **Retries**: configurable per worker via `maxRetries` (default: 3). Throw `NonRetryableError` to skip retries and go straight to dead-letter.
- **Rate limiting**: per-worker `maxRate` option (e.g. `{ count: 10, windowMs: 60_000 }` = max 10 jobs/min)

### Why `server/start.ts`, not a Nitro plugin

An earlier version of this codebase started workers from a `server/plugins/jobs.ts` file using `defineNitroPlugin`, on the assumption that Nitro auto-loads everything in `server/plugins/` , a real feature of Nitro, but one that only activates when Nitro's own Vite plugin is registered with a `scanDirs` pointing at `server/`. This project's `vite.config.ts` never registered it (only `@tanstack/react-start/plugin/vite` was configured, which doesn't turn on Nitro's plugin scanner). The result: `startWorkers()` inside that plugin file never ran, in dev, in `bun run build`, or in the built production bundle , confirmed by a live `bun run dev` with zero job-start log lines and a bundle grep that found no trace of the plugin's code at all. Any job enqueued via `enqueue()` would sit in `data/jobs.db` forever with nothing polling it.

The fix was to drop the Nitro-plugin convention rather than wire up the missing Vite plugin (a much bigger change for what three files actually needed). `server/start.ts` is the one file guaranteed to run in production (`bun run start` / `bun cluster.ts`) and never inspected by Vite's client bundler at all, so `startWorkers()`/`stopWorkers()` , plus Sentry init and startup reconciliation, which have the identical constraint , now live there directly. **This means none of these startup side effects run under `bun run dev`** , there's no dev-mode equivalent currently. If you need to exercise job workers locally, run `bun run build && bun run start`.

## Key Files

| File | Purpose |
|------|---------|
| `src/features/jobs/types.ts` | `AppJobs` type map , all job payloads |
| `src/features/jobs/queue.server.ts` | Singleton `JobQueue<AppJobs>` |
| `src/features/jobs/enqueue.ts` | `enqueue(type, data)` , call from anywhere server-side |
| `src/features/jobs/workers.ts` | Register workers; `startWorkers()` / `stopWorkers()` |
| `src/features/jobs/scheduler.server.ts` | `SCHEDULES` registry, `getScheduler()`, `startScheduler()` / `stopScheduler()` |
| `src/features/jobs/handlers/` | One file per job type |
| `src/features/jobs/server/jobs-admin-logic.ts` | Pure logic for admin queries/mutations (injectable, testable) |
| `src/features/jobs/server/jobs-admin.queries.ts` | Admin server fns: stats, list, types, schedules |
| `src/features/jobs/server/jobs-admin.mutations.ts` | Admin server fns: cancel, retry, purge, pause/resume schedule |
| `server/start.ts` | Production entry point , boots workers on server start, stops them on shutdown |

## Adding a New Job Type

### 1. Add to the type map

```ts
// src/features/jobs/types.ts
export type AppJobs = {
  'email:welcome': { email: string; name: string | null };
  'email:receipt': { email: string; amount: number; currency: string }; // new
};
```

### 2. Write the handler

```ts
// src/features/jobs/handlers/email-receipt.ts
import type { Job } from '@bitclaw/jobs';
import { NonRetryableError } from '@bitclaw/jobs';
import type { AppJobs } from '@/features/jobs/types';

export const handleReceiptEmail = async (
  job: Job<AppJobs['email:receipt']>
): Promise<void> => {
  const result = await sendReceiptEmail(job.data.email, job.data.amount, job.data.currency);

  if (!result.ok) {
    // Permanent failure (e.g. invalid address) , skip retries
    if (result.code === 'EMAIL_ADDRESS_INVALID') {
      throw new NonRetryableError(result.message);
    }
    // Transient failure (e.g. SMTP timeout) , throw to trigger retry
    throw new Error(result.message);
  }
};
```

### 3. Register the worker

```ts
// src/features/jobs/workers.ts , add inside startWorkers()
workers.push(
  queue.createWorker({
    type: 'email:receipt',
    handler: handleReceiptEmail,
    pollIntervalMs: 1000,
    maxRate: { count: 10, windowMs: 60_000 }
  })
);
```

### 4. Enqueue from anywhere server-side

```ts
import { enqueue } from '@/features/jobs/enqueue';

// Inside a server function, after a successful write:
enqueue('email:receipt', { email: user.email, amount: 2000, currency: 'usd' });
```

## Testing Job Handlers

Test handlers directly , no need to spin up the full queue or workers:

```ts
// src/features/jobs/handlers/email-receipt.test.ts
import { describe, expect, it } from 'bun:test';
import { http, HttpResponse } from 'msw';
import type { Job } from '@bitclaw/jobs';
import { mswServer } from '@/test/msw/server';
import type { AppJobs } from '@/features/jobs/types';
import { handleReceiptEmail } from './email-receipt';

// MSW lifecycle is set up globally in src/test/setup.ts

const makeJob = (data?: Partial<AppJobs['email:receipt']>): Job<AppJobs['email:receipt']> =>
  ({ id: 1, type: 'email:receipt', data: { email: 'test@example.com', amount: 2000, currency: 'usd', ...data } }) as Job<AppJobs['email:receipt']>;

it('sends receipt email', async () => {
  mswServer.use(
    http.post('https://api.resend.com/emails', () =>
      HttpResponse.json({ id: 'email_test_123' })
    )
  );
  await expect(handleReceiptEmail(makeJob())).resolves.toBeUndefined();
});

it('throws on transient failure so worker retries', async () => {
  mswServer.use(
    http.post('https://api.resend.com/emails', () =>
      HttpResponse.json({ name: 'internal_server_error', message: 'Service unavailable' }, { status: 500 })
    )
  );
  await expect(handleReceiptEmail(makeJob())).rejects.toThrow();
});
```

## Configuration

```bash
# .env , override the job queue DB path (optional, default: data/jobs.db)
JOBS_DB_PATH=data/jobs.db
```

## Dead-Letter Queue

Jobs that exhaust all retries (or throw `NonRetryableError`) are moved to the dead-letter table in `data/jobs.db`. Inspect via:

```bash
# Use any SQLite browser on data/jobs.db (the queue DB is separate from the
# shared app DB and from Drizzle's migration tooling)
sqlite3 data/jobs.db 'SELECT * FROM failed_jobs ORDER BY failed_at DESC LIMIT 20'
```

The dead-letter table is `failed_jobs`. Columns: `original_job_id`, `type`, `data`, `error`, `retry_count`, `failed_at`.

## Scheduler (Cron Jobs)

`@bitclaw/jobs` includes a DB-backed `Scheduler` that persists pause/resume state across restarts. All schedule definitions live in `src/features/jobs/scheduler.server.ts`.

### How it works

```ts
// src/features/jobs/scheduler.server.ts (trimmed - see the real file for all
// three schedules and their comments)
import { Scheduler } from '@bitclaw/jobs';
import { getJobQueue } from './queue.server';
import type { AppJobs } from './types';

export const SCHEDULES: Array<{
  name: string;
  type: keyof AppJobs;
  cron: string;
  data: Record<string, never>;
  overlap: boolean;
}> = [
  {
    name: 'reengagement-scan',
    type: 'email:reengagement-scan',
    cron: '0 9 * * *', // daily at 9am
    data: {},
    overlap: false // skip if previous run still in progress
  }
  // ...plus 'reconcile-deletions' (every 15 min) and 'snapshot-mrr' (daily)
];

// Creates a NEW Scheduler bound to the current job queue on every call,
// deliberately not a cached singleton - so the admin page shows the full
// schedule list before the first tick has run.
export const getScheduler = (): Scheduler<AppJobs> => {
  const scheduler = new Scheduler(getJobQueue());
  for (const s of SCHEDULES) {
    scheduler.register(s.name, s.type, s.cron, {
      data: s.data,
      overlap: s.overlap
    });
  }
  return scheduler;
};

let tickTimer: ReturnType<typeof setInterval> | null = null;

export const startScheduler = (): void => {
  if (tickTimer) return;
  const scheduler = getScheduler();
  scheduler.cleanup(SCHEDULES.map(s => s.name));
  scheduler.tick(); // run immediately on boot to catch missed schedules
  tickTimer = setInterval(() => {
    const s = getScheduler();
    s.cleanup(SCHEDULES.map(sc => sc.name));
    s.tick();
  }, 60_000);
};

export const stopScheduler = (): void => {
  if (!tickTimer) return;
  clearInterval(tickTimer);
  tickTimer = null;
};
```

`startScheduler()` / `stopScheduler()` are called inside `startWorkers()` / `stopWorkers()` in `workers.ts`.

### Adding a scheduled job

1. Add payload type to `types.ts`:
   ```ts
   'my:scan': Record<string, never>
   ```

2. Create handler in `handlers/my-scan.ts`. Use dynamic imports for `@/lib/db` to avoid client bundle leak:
   ```ts
   import type { Job } from '@bitclaw/jobs';
   import type { AppJobs } from '@/features/jobs/types';

   export const handleMyScan = async (_job: Job<AppJobs['my:scan']>): Promise<void> => {
     const [{ db }, { users }] = await Promise.all([
       import('@/lib/db'),
       import('@/lib/db/schema')
     ]);
     // ... do work
   };
   ```

   **Why dynamic imports?** `jobs/index.ts` exports `startWorkers`, which transitively imports handlers. Vite's import-protection blocks `**/lib/db/**` from reaching the client bundle. Static imports in handlers trigger this even though the handler never runs in the browser. Dynamic imports inside the handler body are excluded from the client bundle trace.

3. Register the worker in `workers.ts`:
   ```ts
   workers.push(queue.createWorker({ type: 'my:scan', handler: handleMyScan, pollIntervalMs: 5000 }));
   ```

4. Add to `SCHEDULES` in `scheduler.server.ts`:
   ```ts
   { name: 'my-scan', type: 'my:scan', cron: '0 3 * * *', data: {}, overlap: false }
   ```

### Admin UI

`/dashboard/admin/scheduled-jobs` shows all registered schedules with enabled/paused status, cron expression, last/next run times, and a pause/resume toggle per schedule.

Server fns: `getSchedulesList` (query), `pauseScheduleAdmin` / `resumeScheduleAdmin` (mutations) in `src/features/jobs/server/`.

Query key: `adminSchedulesQueryKey()`. Query options: `schedulesQueryOptions` exported from `src/features/jobs/index.ts`.

### Pause / resume

```ts
import { pauseScheduleAdmin, resumeScheduleAdmin } from '@/features/jobs';

await pauseScheduleAdmin({ data: { name: 'reengagement-scan' } });
await resumeScheduleAdmin({ data: { name: 'reengagement-scan' } });
```

State persists in the jobs DB across restarts, no code changes needed.

## Delayed Jobs

Pass `runAt` in the options to schedule a job for future execution. The worker polls every second and skips jobs whose `runAt` is in the future.

```ts
import { enqueue } from '@/features/jobs/enqueue';

// Run 5 minutes from now , allows dependent state to settle first
enqueue(
  'cleanup:expired-sessions',
  { userId },
  { runAt: new Date(Date.now() + 5 * 60 * 1000) }
);
```

**When to use:** cleanup or follow-up jobs that depend on external state settling before they run , DNS propagation, cache TTL expiry, a deployment completing on another server. Fire-and-forget: the caller returns immediately; the job runs when `runAt` arrives.

**When not to use:** jobs that must complete before the response returns. Those belong inline in the server function or in a domain event handler.

## Global vs Per-User Jobs

Most jobs target a specific user's data and carry `userId` in the payload:

```ts
// Per-user , targets one user's database
'server:provision': { userId: string; serverId: string; ... };
enqueue('server:provision', { userId, serverId, ... });
```

For system-wide maintenance tasks (uptime checks, DB cleanup, metric collection), use a **global job** with an empty payload. The handler reads all users from the shared meta DB and processes each in isolation:

```ts
// Global job , no userId in payload
'uptime:check': Record<string, never>;

export const handleUptimeCheck = async (_job: Job<Record<string, never>>) => {
  const allUsers = await db.select({ id: users.id }).from(users);
  for (const user of allUsers) {
    try {
      await checkUserData(getUserDb(user.id), user.id);
    } catch {
      // per-user isolation , one failure does not skip the rest
    }
  }
};
```

**When to use global:** tasks that must run across all users on a schedule (uptime polling, nightly cleanup). Enqueue once via the scheduler or a cron trigger; the handler fans out internally. **Do not** use global jobs when the work is user-initiated or requires per-user auth context , use per-user jobs with `userId` in the payload instead.

## Fire-and-Forget Async (IIFE Pattern)

For long-running work that doesn't need job-queue persistence, the IIFE pattern lets a server function return immediately while background work continues:

```ts
// In a server function or logic fn , returns {runId} before work completes
async function startLongOperation(db: Database, runId: string, runFn: RunFn) {
  db.run(`INSERT INTO runs (id, status) VALUES (?, 'running')`, [runId]);

  // Fire and forget , response returns, this continues in background
  (async () => {
    try {
      const result = await runFn();
      db.run(`UPDATE runs SET status='completed', result=? WHERE id=?`, [JSON.stringify(result), runId]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      db.run(`UPDATE runs SET status='failed', error=? WHERE id=?`, [message, runId]);
    }
  })();

  return ok({ runId });
}
```

The caller polls for completion by querying the run status (e.g. with `refetchInterval` in TanStack Query).

**Use this when:**
- Work is long-running (seconds to minutes) but ephemeral , results written to DB
- Failure is acceptable and recoverable , mark status `'failed'` in the catch block
- No retry logic needed , one attempt is enough
- Work doesn't need to survive a server restart

**Use the job queue instead when:**
- Work must survive server restarts (jobs persist in `data/jobs.db`)
- Retry logic is needed (`maxRetries`, `NonRetryableError`)
- Work needs scheduling (`runAt`) or rate limiting (`maxRate`)
- Work must be auditable or inspectable (dead-letter table)

## External Process Execution (Bun.spawn)

For CLI tools or system utilities, `Bun.spawn` is the standard , no npm package needed:

```ts
const proc = Bun.spawn(['dig', '+short', domain, 'A', '@1.1.1.1'], {
  stdout: 'pipe',
  stderr: 'pipe',
});
const output = await new Response(proc.stdout).text();
await proc.exited;
const ips = output.trim().split('\n').filter(line => /^\d+\.\d+\.\d+\.\d+$/.test(line));
```

**Gate ordering:** `Bun.spawn` is an external call , run it **outside** `withWriteLock`. Write the result to the DB inside the lock after the process completes. (Same rule as network calls , don't hold the lock while waiting for I/O.)
