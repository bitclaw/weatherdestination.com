---
name: commit-message
description: Generate a git commit message following warpkit guidelines: Seven Rules + Conventional Commits
user-invocable: true
---

Generate a commit message for the work completed in this session.

## The Seven Rules

1. Separate subject from body with a blank line
2. Limit subject line to 50 characters
3. Capitalize subject line
4. Do not end subject line with a period
5. Use imperative mood in subject line ("Fix bug" not "Fixed bug")
6. Wrap body at 72 characters
7. Use body to explain what and why, not how

## Format

On top of the Seven Rules, use Conventional Commits:

```
<type>(<scope>): <imperative summary>

<body: only if needed>
```

**Types:** `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, `revert`

**Scope:** optional, short noun: feature name, file, or subsystem (`billing`, `auth`, `db`, `ci`)

**Breaking changes:** append `!` after type/scope and add `BREAKING CHANGE:` in body.

## Body guidance

Use body to explain what and why, not how: the diff shows how. Skip entirely when the subject is self-explanatory. Wrap at 72 chars. Bullets use `-` not `*`.

## What NEVER goes in

- "This commit does X": the diff says what
- "I", "we", "now", "currently"
- "As requested by...": use `Co-Authored-By` trailer
- AI attribution
- Restating the file name when scope already says it
- Vague filler ("various improvements", "misc fixes")

## Auto-clarity

Always include body for: breaking changes, security fixes, data migrations, reverts. Never compress these into subject-only: future debuggers need the context.

## Examples

Diff: new server function for item deletion
```
feat(example): add deleteItem server function

Needed for the dashboard list view where users can remove stale entries.
Uses withWriteLock to prevent concurrent delete/insert races.
```

Diff: fix billing route search params
```
fix(billing): pass required search params to billing Link

UpgradeGate's Link to /billing was missing success and canceled search
params, which validateSearch requires: caused a type error at build time.
```

Diff: CI pipeline
```
ci: add GitHub Actions workflow

Runs typecheck, lint, test, and build on every push and PR.
```

## Boundaries

Before writing: check `git diff` vs main to see what's actually in the branch: only reflect that work.

Output commit message text only: never run `git commit` or `git push`.
