.DEFAULT_GOAL := help

.PHONY: help init scaffold install dev build start start.cluster typecheck lint fix test test.watch \
        test.load test.load.quick e2e e2e.all e2e.ui e2e.webkit e2e.report e2e.setup dev.e2e \
        db.generate db.migrate db.seed db.studio clean ci knip favicons \
        mail.up mail.down mail.logs loadtest.seed check-error-codes \
        check-barrel-pages check-prefetch-bare check-webhook-idempotency \
        check-client-bundle-leaks check-ratelimit-keying stripe.setup \
        github.oauth.setup

help:
	@grep -E '^[a-zA-Z0-9_.]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

init: ## Bootstrap new project: copy env, generate secret, install, migrate, seed
	@bun scripts/init-env.ts
	@bun install --frozen-lockfile
	@bun run db:migrate
	@bun run db:seed

stripe.setup: ## Create Stripe products/prices from config.ts and wire price IDs into .env (override target file: make stripe.setup ENV_FILE=.env.production)
	@bun scripts/setup-stripe.ts $(ENV_FILE)
	@echo ""
	@echo "  Done. Next:"
	@echo "  1. Edit config.ts  -- set appName, domainName, Stripe plans"
	@echo "  2. Fill in .env    -- Stripe keys, Resend key, ADMIN_EMAILS"
	@echo "  3. Set Stripe webhook URL to https://yourdomain/api/v1/stripe-webhook"
	@echo "  4. make dev"
	@echo ""
	@echo "  Optional: see README for resetting git history."
	@echo ""

github.oauth.setup: ## Guided GitHub OAuth App creation, writes creds into env (ENV=local|prod, default local)
	@bun scripts/setup-github-oauth.ts --env=$(or $(ENV),local)

scaffold: ## Scaffold warpkit into TARGET= (FORCE=1, DRY_RUN=1, BOOTSTRAP=0, OVERWRITE_PROTECTED=1)
	@[ -n "$(TARGET)" ] || (echo "Error: TARGET required. Usage: make scaffold TARGET=/path/to/repo" && exit 1)
	@FORCE=$(FORCE) DRY_RUN=$(DRY_RUN) BOOTSTRAP=$(BOOTSTRAP) OVERWRITE_PROTECTED=$(OVERWRITE_PROTECTED) bun scripts/scaffold.ts $(TARGET)

install: ## Install dependencies (frozen lockfile)
	@bun install --frozen-lockfile

dev: ## Start dev server on port 3000
	@bun run dev

build: ## Production build
	@bun run build

start: ## Run built output
	@bun run start

start.cluster: ## Run built output with one worker per CPU core
	@bun run start:cluster

prod: build start ## Build + start production server (Ctrl+C to stop)

prod.cluster: build start.cluster ## Build + start clustered server (one worker per CPU core)

typecheck: ## Type-check (generates routes first)
	@bun run typecheck

lint: ## Lint + format check with Biome (CI-safe, no writes)
	@bun run lint

fix: ## Format + lint fix with Biome
	@bun run lint:fix

knip: ## Dead code detection
	@bunx knip

test: ## Run tests
	@bun run test

test.watch: ## Run tests in watch mode
	@bun run test:watch

e2e: ## Run Playwright e2e tests locally (Chromium only, always starts fresh server)
	@CI=true bun run test:e2e:chromium

e2e.all: ## Run Playwright e2e tests on all browsers (always starts fresh server)
	@CI=true bun run test:e2e

e2e.ui: ## Run e2e tests headed in Chromium (reuses existing dev.e2e server)
	@bun run test:e2e:ui

e2e.webkit: ## Run e2e tests headed in WebKit (reuses existing dev.e2e server)
	@bun run test:e2e:webkit

e2e.report: ## Open last Playwright e2e test report
	@bun run test:e2e:report

e2e.setup: ## Wipe and reinitialize isolated e2e databases (run before make dev.e2e)
	@DATABASE_PATH=e2e/data/meta_e2e.db USER_DATA_DIR=e2e/data/users bun run db:migrate
	@DATABASE_PATH=e2e/data/meta_e2e.db USER_DATA_DIR=e2e/data/users bun run db:seed

signoff: ## Run e2e locally and sign off via gh-signoff (requires: gh extension install basecamp/gh-signoff)
	@if ! gh extension list | grep -q gh-signoff; then \
	  echo "gh-signoff not installed - run: gh extension install basecamp/gh-signoff"; exit 1; \
	fi
	@$(MAKE) e2e
	@gh signoff e2e

dev.e2e: ## Start dev server with isolated e2e databases (use instead of make dev for e2e testing)
	@DATABASE_PATH=e2e/data/meta_e2e.db USER_DATA_DIR=e2e/data/users ADMIN_EMAILS=loadtest@example.com bun run dev

db.generate: ## Generate Drizzle migrations
	@bun run db:generate

db.migrate: ## Run Drizzle migrations
	@bun run db:migrate

db.seed: ## Seed default data (feature flags etc.) , idempotent
	@bun run db:seed

db.studio: ## Open Drizzle Studio on the shared DB
	@bun run db:studio

clean: ## Remove build artifacts
	@bun run clean

ci: ## Run full CI pipeline locally (build first so generated content is available to tests)
	@$(MAKE) typecheck
	# BETTER_AUTH_SECRET is set explicitly (not via .env/.env.test) because
	# Bun auto-loads .env.${NODE_ENV} based on this exact variable - under the
	# previous NODE_ENV=test this build step silently rode along on
	# .env.test's placeholder secret as a side effect, not on purpose. Now
	# that the build genuinely runs under NODE_ENV=production (see
	# src/start.ts's TSS_PRERENDERING comment for why), Bun would instead
	# look for .env.production, which doesn't exist in CI (or a real one
	# does exist in production and must never be the source of a build-time
	# secret). A local .env with a real secret masks this locally; a clean CI
	# runner has neither, so the placeholder must be explicit here, matching
	# the Dockerfile's own build-stage placeholder.
	@NODE_ENV=production BETTER_AUTH_SECRET=ci-build-secret-not-used-in-production-placeholder bun run build
	@$(MAKE) lint knip test check-error-codes check-barrel-pages check-prefetch-bare check-webhook-idempotency check-client-bundle-leaks check-boot check-ratelimit-keying check-exact-deps

check-exact-deps: ## Fail if package.json has any non-exact version specifier (^, ~, etc.)
	@bun run scripts/check-exact-deps.ts

dep-risk: ## Analyze the risk of bumping one dependency: make dep-risk pkg=<name> version=<target>
	@bun run scripts/dep-risk.ts "$(pkg)" "$(version)"

check-error-codes: ## Fail if any server fn uses a raw string in err() instead of ERROR_CODES.*
	@if grep -rn --include="*.ts" --include="*.tsx" "err('" src/ | grep -v "//.*err('"; then \
	  echo "❌ Raw string in err() — use ERROR_CODES.*"; exit 1; \
	fi
	@if grep -rlPzo --include="*.ts" --include="*.tsx" "err\(\s*['\"][A-Z_]+['\"]" src/ 2>/dev/null | grep -q .; then \
	  echo "❌ Raw string in err() (multi-line call) — use ERROR_CODES.* in:"; \
	  grep -rlPzo --include="*.ts" --include="*.tsx" "err\(\s*['\"][A-Z_]+['\"]" src/; \
	  exit 1; \
	fi

check-barrel-pages: ## Fail if any feature barrel (index.ts) exports a Page component
	@if grep -rnP "export (const|function) \w*Page\b" src/features/*/index.ts 2>/dev/null; then \
	  echo "❌ Page component exported from barrel — import directly from features/*/pages/ in routes"; exit 1; \
	fi

check-prefetch-bare: ## Fail if any route uses a bare object in prefetchQuery/ensureQueryData instead of a queryOptions() factory
	@if grep -rlPzo --include="*.tsx" "prefetchQuery\(\s*\{" src/routes/ 2>/dev/null | grep -q .; then \
	  echo "❌ Bare object in prefetchQuery — use a queryOptions() factory in:"; \
	  grep -rlPzo --include="*.tsx" "prefetchQuery\(\s*\{" src/routes/; \
	  exit 1; \
	fi
	@if grep -rlPzo --include="*.tsx" "ensureQueryData\(\s*\{" src/routes/ 2>/dev/null | grep -q .; then \
	  echo "❌ Bare object in ensureQueryData — use a queryOptions() factory in:"; \
	  grep -rlPzo --include="*.tsx" "ensureQueryData\(\s*\{" src/routes/; \
	  exit 1; \
	fi

# Whole-file presence check, not per-handler — catches wholesale removal of the
# dedup pattern during a future refactor. Does not verify the guard is wired
# correctly for every webhook branch; see docs/warpkit/patterns/webhook-replay.md.
check-webhook-idempotency: ## Fail if the billing webhook handlers are missing their replay-dedup guards
	@if ! grep -rq "findFirst" src/features/billing/server/stripe-*.server.ts 2>/dev/null; then \
	  echo "❌ Missing dedup read (findFirst) in src/features/billing/server/stripe-*.server.ts — see docs/warpkit/patterns/webhook-replay.md"; exit 1; \
	fi
	@if ! grep -q "isReplay" src/features/billing/server/stripe-checkout.server.ts 2>/dev/null; then \
	  echo "❌ Missing isReplay guard in stripe-checkout.server.ts — see docs/warpkit/patterns/webhook-replay.md"; exit 1; \
	fi

# Scans dist/client/ ONLY (never dist/server/) for markers that should never
# survive a client build. Markers are chosen to be import-specifier/API-call
# shaped, not bare package names — "pino" and "bun:sqlite" were tried first
# and both false-positived (pino ships a legit browser shim bundlers
# auto-resolve to; "bun:sqlite" showed up verbatim in landing-page marketing
# copy). Every marker here was verified clean against a real build before
# being added — if you add one, verify it the same way first.
check-client-bundle-leaks: ## Fail if a server-only marker survived into the client bundle
	@test -d dist/client || (echo "❌ dist/client missing — run after 'bun run build'"; exit 1)
	@for marker in "node:crypto" "node:child_process" "node:fs" "node:dns" \
	               "createCipheriv" "randomBytes(" "pino-pretty" \
	               "@aws-sdk/client-s3" "GetObjectCommand" "new Resend(" \
	               "StripeResource" "better-auth/dist/plugins"; do \
	  if grep -rl -- "$$marker" dist/client/assets/*.js 2>/dev/null | grep -q .; then \
	    echo "❌ Server-only marker '$$marker' found in dist/client/ — check for a top-level import in a *.mutations.ts/*.queries.ts file that should be a dynamic import() inside the handler body instead"; \
	    grep -rl -- "$$marker" dist/client/assets/*.js; \
	    exit 1; \
	  fi; \
	done

# Boots the real production entry point (server/start.ts) as a real
# subprocess and verifies job workers start + the process exits cleanly on
# SIGTERM. Everything else in this file is static text analysis; this is
# the one check that actually executes the built app, because "code exists
# but its container never runs" (the server/plugins/ Nitro-plugin bug) is
# invisible to every other check here, to unit tests calling functions
# directly, and to e2e against the dev server. See docs/warpkit/features/jobs.md's
# "Why server/start.ts, not a Nitro plugin".
check-boot: ## Spawn the real production server, verify workers start + graceful shutdown
	@test -f dist/server/server.js || (echo "❌ dist/server/server.js missing — run after 'bun run build'"; exit 1)
	@bun tests/boot-smoke.ts

# Mechanical, not exhaustive: per-handler line-order scan (resets at each
# .handler(async boundary) that flags an unkeyed *Limiter.check() appearing
# AFTER an `await requireUser()`/`await requireAdmin()` call earlier in the
# same handler — that ordering means the caller's id is already known and
# should be used to key the check, not left to fall back to IP. A bare
# mention of "requireAdmin()" in a comment does NOT count (comment lines are
# skipped) — this tripped twice during development against admin.mutations.ts's
# own two-tier-pattern doc comment before that exclusion was added. Doesn't
# catch every shape (e.g. an unkeyed .check() that intentionally runs BEFORE
# auth as a pre-auth IP gate is correctly ignored) — a human still reads the
# flagged file, this doesn't replace judgment, just narrows where to look.
check-ratelimit-keying: ## Fail if a rate limiter's .check() runs unkeyed after the caller's id is already known
	@ok=1; \
	for f in $$(grep -rl "requireUser()\|requireAdmin()" src/features/*/server/*.mutations.ts src/features/*/server/*.queries.ts 2>/dev/null); do \
	  hit=$$(awk ' \
	    BEGIN { seen_auth = 0 } \
	    /^[ \t]*\/\// { next } \
	    /\.handler\(async/ { seen_auth = 0 } \
	    /await requireUser\(\)|await requireAdmin\(\)/ { seen_auth = 1 } \
	    seen_auth == 1 && /[A-Za-z_]+Limiter\.check\(\)[^.]/ { print FILENAME ":" FNR ": " $$0 } \
	  ' "$$f"); \
	  if [ -n "$$hit" ]; then echo "❌ $$hit"; ok=0; fi; \
	done; \
	if [ "$$ok" = "0" ]; then \
	  echo "❌ Rate limiter .check() called unkeyed after the caller's id was already resolved — key it by user.id/adminResult.data.id (see touchApiKeyFn or admin.mutations.ts's requireRateLimitedAdmin for the pattern)"; \
	  exit 1; \
	fi

favicons: ## Regenerate favicon assets from public/icon.svg + public/logo.svg
	@bun scripts/generate-favicons.ts

indexnow.submit: ## Notify Bing/Yandex/etc. of every sitemap URL via IndexNow
	@bun scripts/indexnow-submit.ts

loadtest.seed: ## Seed 1000 loadtest users with per-user SQLite DBs (writes data/loadtest-sessions.json)
	@NODE_ENV=production bun scripts/seed-loadtest.ts

mail.up: ## Start Mailpit local SMTP + web UI (http://localhost:8025)
	@docker run -d --name mailpit --rm \
		-p 1025:1025 -p 8025:8025 \
		-e MP_SMTP_AUTH_ACCEPT_ANY=1 \
		-e MP_SMTP_AUTH_ALLOW_INSECURE=1 \
		axllent/mailpit

mail.down: ## Stop Mailpit
	@docker stop mailpit

mail.logs: ## Tail Mailpit logs
	@docker logs -f mailpit
