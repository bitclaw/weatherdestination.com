---
name: commands
description: Common warpkit dev commands: CI, dev server, DB, tests, linting
user-invocable: true
---

# warpkit Dev Commands

## Daily workflow

```bash
make dev              # dev server on http://localhost:3000
make test             # run all tests
make test.watch       # watch mode
make fix              # Biome auto-fix (safe fixes only)
make ci               # full local CI: run before pushing
```

## CI (what runs in GitHub Actions)

```bash
make ci
# Runs, in order (build first so generated content is available to tests):
#   make typecheck
#   NODE_ENV=test bun run build
#   make lint knip test check-error-codes check-barrel-pages check-prefetch-bare
```

Run `make ci` before every PR. It matches what CI checks.

## Database

```bash
make db.generate      # generate migration from schema changes (bun run db:generate)
make db.migrate       # apply pending migrations (bun run db:migrate)
make db.studio        # open Drizzle Studio on the shared DB
```

## Linting & formatting

```bash
make lint             # Biome lint check (no writes)
make fix              # Biome lint + format auto-fix
```

Note: Biome only auto-applies "safe" fixes. Unsafe fixes (e.g. `noAutofocus`) need manual edits.

## Dependencies

```bash
bun install                     # install deps
bun install --frozen-lockfile   # CI-safe install (fails on lockfile drift)
bun add <package>               # add a dependency
bun update <package>            # update a specific package
```

## Build

```bash
make build            # production build (bun run build)
make clean            # remove node_modules/.vite, .vinxi/, .nitro/, .output/
```

## Environment setup (first time)

```bash
cp .env.example .env
bun install
make db.migrate
make dev
```

## All make targets

```
make help             # list all targets with descriptions
```
