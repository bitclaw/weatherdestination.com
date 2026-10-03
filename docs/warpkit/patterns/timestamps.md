# Timestamps

**Decided:** 2026-10-03, for warpkit and every project derived from it
(warpkit-postgres, warpkit.dev, weatherdestination.com, runmist). This doc
is identical in all of them; change it everywhere or nowhere.

## The rule

| Store | Type | In code |
|---|---|---|
| SQLite, shared DB (Drizzle) | `integer(..., { mode: 'timestamp_ms' })`, epoch **milliseconds** | `Date` |
| SQLite, raw SQL (per-user, per-workspace DBs) | `INTEGER`, epoch **milliseconds** | `number` from `nowMs()` |
| Postgres (warpkit-postgres) | `timestamp(..., { withTimezone: true })`, i.e. `timestamptz` | `Date` |
| `jobs.db` (`@bitclaw/jobs`) | ISO-8601 text, written by the package | never read raw by apps |

Every column that records an instant follows it: `*_at`, and also columns
such as `ban_expires`, `locked_until`, `trial_end`, `current_period_end`,
`active_until` and `snoozed_until`. `0` means "never"; `NULL` means unknown or
not set. Negative values are never valid.

Not covered: wall-clock schedules ("back up at 03:00 local"). Store those as
a local time plus an IANA time zone, never as an instant.

## Why epoch ms, not ISO text

SQLite has no native date type. The choice is ISO-8601 text or an integer.

- **Comparisons stay integer against integer.** With text, a column compared
  against a number parameter is silently wrong: SQLite sorts every text
  value above every number, so `created_at >= ?` matches every row. Mixed
  text formats (`2026-10-03 14:10:12` from `datetime('now')` versus
  `2026-10-03T14:10:12.000Z` from JS) also break ordering silently. No
  trigger can see a bad comparison.
- **The bugs we actually had were wrong-unit writes**, and a value guard
  catches those at write time (see Enforcement). Seconds written into an ms
  column happened in the settings helper of three repos and in runmist's
  git accounts; text in an integer column happened in runmist's cloud
  accounts (`docs/runmist/bugs/workspace-timestamp-units.md` in runmist).
- **Most write sites already emit ms** (`Date.now()`), so the change is a
  Drizzle mode flip and a data migration, not a rewrite.

The cost is readability: a raw value is a number. See Reading values below.

## Writing

- Raw SQL: pass `nowMs()` from `src/lib/time.ts` as a parameter. Never use a
  SQLite clock function (`datetime('now')`, `CURRENT_TIMESTAMP`,
  `unixepoch(`, `strftime('%s'`) outside migrations.
- Provider APIs that return seconds (OAuth `expires_in`, Unix timestamps):
  convert with `msFromSeconds()` at the boundary.
- Drizzle: pass `Date` objects; `$defaultFn(() => new Date())` is correct.
- SQLite date functions on a column: divide by 1000 first,
  `strftime('%Y-%m', ${table.createdAt} / 1000, 'unixepoch')`. The
  `'unixepoch'` modifier reads seconds.
- Postgres: pass `Date` objects.

## Enforcement

- **`make check-sql-time`** (part of `make ci`) fails on a SQLite clock
  function in app code outside `src/lib/db/migrations/`, and on a
  `'unixepoch'` modifier without `/ 1000` on the same line.
- **Guard triggers** on every SQLite DB, installed on every open (and by
  `makeTestDb()`), so tests and production both enforce the rule. Each
  timestamp column gets a `BEFORE INSERT` and `BEFORE UPDATE` trigger:

  ```sql
  RAISE(ABORT) WHEN NEW.col IS NOT NULL AND (
    typeof(NEW.col) <> 'integer'
    OR (NEW.col <> 0 AND NEW.col < 100000000000)
  )
  ```

  100000000000 (1e11) ms is 1973-03-03. A seconds value today is about
  1.79e9 and reaches 1e11 only in the year 5138, so the threshold separates
  seconds from milliseconds for any date we store. Columns come from the
  schema (every `timestamp_ms` Drizzle column) plus a per-repo allowlist of
  raw-SQL timestamp columns, never from a name suffix: plain integers such
  as `attempt_count` or `last_status_code` must not get a trigger.
- **A coverage test** asserts every timestamp column has its guard, so a new
  table cannot be added without one.

## Migrating a SQLite repo to this rule

1. **Convert only seconds-scale values.** Multiply a value by 1000 only when
   it is an integer strictly between 0 and 1e11. A value already ≥ 1e11 is
   ms despite the old declaration and is left alone, so nothing can be
   doubled and the migration is safe to re-run.
2. **One UPDATE per table**, converting all its timestamp columns at once.
   The guard triggers check every column of a row, so a per-column update
   would abort on the row's not-yet-converted columns. Then switch the
   schema to `mode: 'timestamp_ms'`.
3. Fix any raw writer that is not ms (the settings helper's `unixepoch()`).
4. Add `src/lib/time.ts`, the guard, its coverage test and
   `make check-sql-time`.
5. After deploy, run the audit (every timestamp column in every DB: no text,
   nothing in (0, 1e11)).

## Reading values

```sql
-- ms column, as UTC
SELECT datetime(created_at / 1000, 'unixepoch') FROM projects;
-- with milliseconds
SELECT strftime('%Y-%m-%dT%H:%M:%fZ', created_at / 1000.0, 'unixepoch') FROM projects;
-- rows from the last 24 hours
SELECT * FROM projects WHERE created_at >= (unixepoch() - 86400) * 1000;
```

(`unixepoch()` is fine in an ad-hoc query; only app code is banned from it.)
