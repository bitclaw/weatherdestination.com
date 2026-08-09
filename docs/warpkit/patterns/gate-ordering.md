# Gate Ordering

Server functions that write to the database often need to check preconditions first: does the user have credits? Is the resource in the right state? Is the plan limit not exceeded?

Where you place these checks matters. Putting a mutable state check outside `withWriteLock` creates a TOCTOU (time-of-check/time-of-use) race: the state can change between the check and the write.

## The rule

**Read-only gates** go **before** `withWriteLock`.
**Mutable state gates** go **inside** `withWriteLock` with a fresh DB read.

| Gate type | Examples | Where |
|-----------|---------|-------|
| Read-only | Backup freshness, S3 bucket existence, feature flag, credential existence, plan tier lookup | Before `withWriteLock` |
| Mutable state | Resource status, uniqueness constraint, count vs limit | Inside `withWriteLock`, fresh read |

Read-only gates don't need atomicity. They can be slow (network calls, S3 checks) and should not hold the lock while they run.

Mutable state gates must be inside the lock with a fresh read , the state you checked before acquiring the lock may already be stale by the time the write runs.

## Wrong: mutable status check outside lock

```ts
// WRONG , race between check and write
const project = db.query('SELECT status FROM projects WHERE id = ?').get(id);
if (project.status === 'deploying') return err('DEPLOYMENT_IN_PROGRESS', '...');

return withWriteLock(user.id, () => {
  // project.status may have changed , stale read!
  db.run('UPDATE projects SET server_id = ?', [targetId]);
});
```

## Right: read-only gates outside, mutable gates inside

```ts
// Read-only gate , slow, doesn't need atomicity, fine before lock
const backupOk = checkBackupFreshness(db, projectId);
if (!backupOk) return err('BACKUP_REQUIRED', '...');

return withWriteLock(user.id, () => {
  // Fresh read inside the lock
  const project = db.query('SELECT status FROM projects WHERE id = ?').get(id);
  if (project.status === 'deploying') return err('DEPLOYMENT_IN_PROGRESS', '...');
  db.run('UPDATE projects SET server_id = ?', [targetId]);
});
```

## Plan limits follow the same rule

Fetch the subscription tier (read-only) before the lock. Enforce the count limit (mutable , another request could insert concurrently) inside the lock:

```ts
// Before lock , read-only, can be slow
const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, user.id) });
const plan = (sub?.plan ?? 'free') as PlanKey;

return withWriteLock(user.id, () => {
  const userDb = getUserDb(user.id);
  const count = listItems(userDb).length; // fresh count inside lock
  const { allowed, used, limit } = checkEntitlement(plan, 'maxNotes', count);
  if (!allowed) return err(ERROR_CODES.PLAN_LIMIT_EXCEEDED, `Limit reached: ${used}/${limit}.`);
  // ... write ...
});
```

## Rate limits

`checkUserRateLimit` reads `user_events` rows , this is a read inside `withWriteLock`. Both the check and the `logUserEvent` call that feeds it belong inside the same lock so they're atomic:

```ts
return withWriteLock(user.id, () => {
  const db = getUserDb(user.id);
  if (checkUserRateLimit(db, 'item.created', { windowMs: 60_000, max: 20 }))
    return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
  // ... write ...
  logUserEvent(db, 'item.created');
});
```
