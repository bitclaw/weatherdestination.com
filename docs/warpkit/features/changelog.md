# Changelog

`/changelog` (`src/routes/_landing.changelog.tsx`) is a static, prerendered
page backed by `src/content/changelog/*.md` via content-collections
(`releases` collection, `content-collections.ts`). `scripts/generate-changelog.ts`
drafts a new entry from recent commits so writing one doesn't mean
reconstructing "what shipped" from memory - it still isn't fully automatic,
on purpose: a public changelog reads badly as a raw commit-message dump, so
the script produces a draft you edit, not final copy.

## `make changelog.draft`

Reads commits since the last run, buckets them by Conventional Commit type,
suggests a version bump and tags, prompts you for the real version/title, and
writes `src/content/changelog/v{version}.md`. Review and edit the result
before committing - bullets are raw, de-prefixed commit subjects.

```bash
make changelog.draft                    # normal run
make changelog.draft SINCE=2026-01-01   # manual slice from a date
make changelog.draft SINCE=abc1234      # manual slice from a commit
```

## How commits are picked (two modes)

**Normal run (no `SINCE`)** reads `.changelog-cursor`, a tracked file
holding the SHA of the last commit a normal run processed:

- Cursor present and non-empty: `git log <cursor>..HEAD`.
- Cursor missing or empty (a fresh template clone ships it empty
  deliberately - a shipped SHA would belong to no history a scaffolded repo
  actually has): falls back to `git log --since=<latest changelog entry's
  date> HEAD`.
- Either way, on success the cursor is advanced to `HEAD`.

If the stored cursor SHA is no longer an ancestor of `HEAD` (rebased or
force-pushed history), the script fails with a hint to rerun with an
explicit `SINCE` instead of surfacing a raw git error.

**`SINCE=<date-or-sha>`** is a deliberate one-off slice: `git log
--since=<date>` or `git log <sha>..HEAD`. It does **not** move the cursor -
advancing it here would make the next normal run see an empty range, or
silently skip whatever the slice didn't cover. Use it for a narrower or
wider draft than "everything since last time," not as your regular workflow.

## Bucketing

Only `feat`/`fix`/`perf`/`seo` become bullets (`New` for `feat`, `Fixed` for
the rest). Everything else - `chore`/`test`/`style`/`ci`/`refactor`, and
**`docs`** - is treated as noise and left out, still counted in the summary
line the script prints. `docs` is skipped deliberately, not by accident: in
practice it's dominated by internal/ops documentation changes, not
reader-facing release notes.

Subjects that don't match a Conventional Commit shape at all (`Initial
commit`, `Run "make scaffold ..."`) are printed verbatim, not just counted -
nothing is silently dropped without you being able to see what it was.

The parser is intentionally more permissive than the strict Conventional
Commits spec, matching real variation seen in this repo's own history:
no-scope subjects (`seo: ...`), scopes with spaces (`docs(coding skill):
...`), and comma-separated multi-scopes (`fix(analytics,observability):
...`) all parse.

## Version and tag suggestions

Based on the most recent existing entry's `version`, plus what's in range:

- Any commit type followed by `!` (e.g. `feat!:`) suggests a **major** bump
  and the `breaking` tag. This is the only breaking-change signal detected -
  grepping commit bodies for a `BREAKING CHANGE:` footer is a known gap, not
  implemented.
- Any `feat` (and no breaking marker) suggests a **minor** bump and `core`.
- Otherwise, a **patch** bump and `fix`.

These are suggestions shown before the prompt, not applied automatically -
you type the real version and title.

## Frontmatter vs. filename version format

The **filename** carries the `v` prefix (`v1.2.0.md`); the **frontmatter**
`version` field does not (`version: "1.2.0"`) - the page template prepends
`v` itself at render. Writing the same string to both produces `vv1.2.0` in
the UI. The script handles this correctly; if you ever hand-write an entry,
match the existing files (`src/content/changelog/v1.0.0.md`) rather than
guessing.

## Backfilling a stale changelog

If entries have lapsed for a while (many commits, no `SINCE` slicing yet):

1. `make changelog.draft` with no `SINCE` - first run (no cursor yet) falls
   back to the latest entry's date, so this pulls in everything since then
   as one draft. That's likely too much for one entry if it's been a while.
2. Hand-partition the draft's bullets into a few real entries by milestone,
   rather than re-running with `SINCE` slices (re-running fights the cursor
   - see the two-mode section above; one full draft you split by hand is
   simpler).
3. Edit each into real release-note prose - the draft is raw commit
   subjects, not publishable copy - and set real dates if reconstructable
   from `git log`.
4. `make ci` validates the new entries against the `releases` schema and
   rebuilds the prerendered page. Commit.

The cursor ends up at `HEAD` from step 1's run either way, so future normal
runs pick up cleanly from there.
