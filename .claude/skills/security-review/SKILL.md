---
name: security-review
description: Security audit of warpkit against the local OWASP Cheat Sheet Series — auth/session/authz, injection/validation/upload, infra/secrets/headers/supply-chain
user-invocable: true
---

# warpkit Security Review

Do a security audit of warpkit against the OWASP Cheat Sheet Series and this repo's own
threat model. Seeded from a 2026-08-06 full audit (1 critical, 5 high, ~16 medium, ~15 low
findings, all subsequently fixed) — read the "verified safe" and "explicitly excluded"
lists below BEFORE starting so this run doesn't re-litigate settled ground.

This is a single-tenant template (per-user SQLite, no workspace/multi-tenant concept, no
GraphQL/WebSocket/SAML). `requireUser()`, `requireAdmin()`, `withWriteLock(user.id, fn)` are
the relevant gates — not `requireWorkspaceMembership`/`withWorkspaceLock`, which are
runmist-warpkit-specific.

## Scope split

Three lanes, matching the structure of the seed audit:

1. **Auth / session / authorization / CSRF / cookies** — `src/server/auth.ts`,
   `src/server/require-*.ts`, `src/server/session-cache.ts`, `src/start.ts`'s
   `securityMiddleware`, better-auth plugin config (admin, multiSession), impersonation.
2. **Injection / validation / upload / SSRF / mass-assignment** — every `.mutations.ts`
   Zod validator, `src/features/uploads/**`, `src/features/ai-chat/**`,
   `src/lib/constants/paths.ts` (redirect sanitization), any endpoint that accepts a URL.
3. **Infra / secrets / headers / logging / supply-chain / third-party integrations** —
   `Dockerfile`, `.github/workflows/*.yml`, `src/lib/logger.ts`, `src/lib/db/settings-helpers.server.ts`
   (encryption), Stripe/Resend/Turnstile/S3 client setup, `bunfig.toml`.

## Curated OWASP Cheat Sheet relevance map

Only these 24 sheets are relevant to this codebase's actual attack surface (full
120-entry index is mostly noise here — see the excluded list below for what was checked
and ruled out). Pull the current text of each from the OWASP Cheat Sheet Series before
citing it, don't rely on memory of prior wording.

| Cheatsheet | Why it applies here |
|---|---|
| Authentication | better-auth OTP/magic-link config, `ADMIN_EMAILS` vs `users.role` desync risk |
| Session Management | `cookieCache`, session revocation, `__Secure-` cookie prefix |
| Authorization | `requireUser`/`requireAdmin`/`requireWorkspaceMembership`-equivalent gates |
| Access Control | admin/impersonation privilege boundaries |
| CSRF Prevention | `createCsrfMiddleware` coverage gaps (server fns vs. `api/**` route handlers) |
| Cookie Theft Mitigation | `HttpOnly`/`Secure`/`SameSite` on every hand-rolled cookie (loadtest routes) |
| Input Validation | Zod schema bounds (`.max()`, allowlist regex) on every mutation |
| Query Parameterization / SQLi Prevention | `bun:sqlite` bound params, no string-interpolated SQL |
| IDOR Prevention | per-user SQLite file boundary, admin `userId` validators |
| Unvalidated Redirects | `sanitizeRedirectPath` in `src/lib/constants/paths.ts` |
| File Upload | S3 presigned POST expiry, MIME-derived extension, quota enforcement |
| SSRF Prevention | any server-side `fetch()` of a user-supplied URL |
| LLM Prompt Injection Prevention | `ai-chat` message role validation, system-prompt isolation |
| Mass Assignment | Zod `.strict()` / explicit field allowlists on mutation inputs |
| HTTP Headers | `securityMiddleware` in `src/start.ts`, response headers on prerendered/static paths |
| Content Security Policy | `buildCsp()`, no `unsafe-eval` in production |
| Clickjacking Defense | `X-Frame-Options: DENY` / `frame-ancestors` |
| HSTS | `Strict-Transport-Security` header presence and `max-age` |
| Secrets Management | `.env.example` vs. real secrets, Docker `--env-file` not `-e`, no secrets in logs |
| Docker Security | non-root user, read-only app code, digest-pinned base image |
| NodeJS Docker Cheat Sheet | multi-stage build, `bunfig.toml` copied before install |
| Nodejs Security | `bunfig.toml`'s `minimumReleaseAge`/`ignoreScripts`, dependency trust |
| Denial of Service | rate limiter coverage (IP + per-user), `TRUST_PROXY` fail-closed behavior |
| Third Party Payment Gateway Integration | Stripe webhook signature verification, replay guards |
| Vulnerable Dependency Management / Supply Chain / NPM Security | Renovate config, SHA-pinned GitHub Actions, digest-pinned Docker base |
| Logging | pino `redact` config, no PII/secrets in log lines |

## Verified safe (carry forward, don't re-litigate)

These were checked in the 2026-08-06 audit and found correct. Spot-check they're still
true (a file may have changed since), but don't spend a full re-investigation on them
absent a specific reason to suspect regression:

- Stripe webhook signature verification (`stripe.webhooks.constructEvent`, real secret
  required, `WebhookConfigError` distinct from bad-signature `Error`)
- Turnstile captcha verified server-side, not just client-side
- All SQL uses parameterized queries via `bun:sqlite`'s bound-param API — no string
  interpolation into SQL anywhere in `src/lib/db/**`
- Per-user-DB IDOR boundary: each user's SQLite file is a hard filesystem-level
  isolation boundary, not just a `WHERE user_id = ?` check
- XSS: React's default escaping everywhere by default. Every `dangerouslySetInnerHTML`
  use site is deliberate and narrow, each with a `biome-ignore` comment naming the
  reason: markdown rendering (`Markdown.tsx`, `ai-chat/chat-panel.tsx`) goes through a
  `rehype-sanitize` pipeline before reaching the DOM; JSON-LD blocks (`seo.ts`,
  `landing-faq.tsx`) are `JSON.stringify`-escaped, not raw user input; `__root.tsx`'s
  theme-init script is a static string, not interpolated data. Re-verify the
  rehype-sanitize pipeline order specifically if either markdown renderer changes —
  sanitize must run after markdown-to-HTML, not before
- Webhook replay guards on Stripe billing events (sync-transaction guard checking
  current state before acting, not just an idempotency key table)
- `requireUser`/`requireAdmin` centralize the auth gate; no feature re-implements its
  own session check

## Explicitly excluded after checking (don't re-check without new evidence)

Confirmed absent by grep across `src/` and `package.json`, not assumed:

- Password Storage Cheat Sheet — this app is passwordless (OTP/magic-link only, no
  password field anywhere in the schema)
- Multi-Factor Authentication Cheat Sheet — passwordless auth has no MFA surface
- GraphQL, WebSocket, XXE, LDAP Injection, NoSQL Injection, SAML, gRPC Security
  Cheat Sheets — none of these technologies are present anywhere in the dependency tree
- Kubernetes Security Cheat Sheet — deployment target is a single Docker container, no
  k8s manifests in this repo
- Every language-specific cheat sheet not covering JS/TS/Node (Java, .NET, PHP, Ruby,
  Go, Rust, etc.)

## Reporting

Report findings as:
- `path:line: FINDING [severity]: <what's wrong>. Fix: <what to change>. Cheatsheet: <name>.`
- `path: VERIFIED SAFE: <what was checked and why it's fine>.` — only for things that
  looked suspicious at a glance but checked out; don't restate the "verified safe" list
  above unless something changed.

Severity: critical (exploitable now, no auth required) / high (exploitable by an
authenticated attacker, or requires a config mistake likely to actually be made) / medium
(defense-in-depth gap, unlikely alone to be exploitable) / low (hardening, best practice).

Before reporting a finding, check it against the "verified safe" and "excluded" lists
above and against `.claude/skills/coding/SKILL.md`'s exceptions list (single-row PK
writes, injectable interfaces) — a finding that requires no verification to report is
more likely a mechanical false positive than a real bug.

## Automating a finding

When a finding is invisible from reading the source (only observable in a built
artifact, a real HTTP response, or a real process boot), don't just report it — add a
regression check to `tests/boot-smoke.ts` (already spawns a real production server) or
`make ci`'s target list, the same way the Wave 0 critical finding (production build
shipping with `NODE_ENV=test` baked in, invisible from source, only visible in
`dist/server/*.js`) graduated into `check-boot`'s header assertions. A manual audit
finding that can recur silently is worth more as an automated check than as a one-time
fix.

## Recommended execution

Delegate this to 3 parallel subagents (Agent tool, background), one each for the three
scope lanes above. Each agent prompt should embed: its lane's file list, the full OWASP
relevance map (so it knows which cheatsheets apply to its lane), the verified-safe list,
and the excluded list — a fresh subagent has no context from this skill invocation.
Compile and spot-verify the combined findings before reporting to the user, same
discipline as `convention-audit`'s "Reporting" step.
