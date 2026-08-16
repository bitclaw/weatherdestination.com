// Generates a DRAFT changelog entry from commits since the last one. Not a
// publish pipeline - bullets are raw, de-prefixed commit subjects, meant to
// be edited into real release-note prose before committing. See
// docs/warpkit/features/changelog.md for the full picture (cursor modes,
// bucketing rules, the frontmatter-vs-filename version format).
//
// Usage:
//   bun scripts/generate-changelog.ts                    # normal: since .changelog-cursor (or last entry's date on first run)
//   bun scripts/generate-changelog.ts --since=2026-01-01  # manual slice - does NOT move the cursor
//   bun scripts/generate-changelog.ts --since=abc1234     # manual slice from a specific commit - does NOT move the cursor
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { prompt } from './lib/prompt';

const CURSOR_PATH = '.changelog-cursor';
const CHANGELOG_DIR = 'src/content/changelog';

// Reader-facing types get a bucket. Everything else (including `docs:` -
// verified against this repo's real history: mostly internal/ops docs, not
// release notes) is noise, deliberately, not an unhandled fall-through.
const TYPE_BUCKETS: Record<string, 'New' | 'Fixed'> = {
  feat: 'New',
  fix: 'Fixed',
  perf: 'Fixed',
  seo: 'Fixed'
};
const NOISE_TYPES = new Set([
  'chore',
  'test',
  'style',
  'ci',
  'refactor',
  'docs'
]);

type ChangelogEntry = { version: string; date: string; file: string };
type ParsedCommit = { type: string; breaking: boolean; summary: string };

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function isAncestor(sha: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], {
      stdio: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}

function looksLikeSha(value: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(value);
}

function readChangelogEntries(): ChangelogEntry[] {
  if (!existsSync(CHANGELOG_DIR)) return [];
  return readdirSync(CHANGELOG_DIR)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const content = readFileSync(path.join(CHANGELOG_DIR, file), 'utf8');
      const version = content.match(/^version:\s*"([^"]+)"/m)?.[1] ?? '';
      const date = content.match(/^date:\s*"([^"]+)"/m)?.[1] ?? '';
      return { version, date, file };
    });
}

function getLatestEntry(): ChangelogEntry | null {
  const entries = readChangelogEntries().filter(e => e.date);
  if (entries.length === 0) return null;
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

// Two distinct modes - see the module doc comment. Only the no-`--since`
// path (cursor file, or its first-run date fallback) advances the cursor;
// an explicit --since is a deliberate slice that must not move it, or a
// later bare run would see an empty range or silently skip whatever the
// slice didn't cover.
function resolveCommitRange(
  sinceArg: string | undefined,
  latestEntry: ChangelogEntry | null
): { logArgs: string[]; advanceCursor: boolean } {
  if (sinceArg) {
    return {
      logArgs: looksLikeSha(sinceArg)
        ? [`${sinceArg}..HEAD`]
        : [`--since=${sinceArg}`, 'HEAD'],
      advanceCursor: false
    };
  }

  // Missing or empty cursor covers both a fresh template clone (ships
  // empty deliberately - a shipped SHA would belong to no history a
  // scaffolded repo actually has) and a genuine first run.
  const cursor = existsSync(CURSOR_PATH)
    ? readFileSync(CURSOR_PATH, 'utf8').trim()
    : '';

  if (cursor) {
    if (!isAncestor(cursor)) {
      console.error(
        `${CURSOR_PATH} (${cursor}) is no longer an ancestor of HEAD - rebased or force-pushed history? Rerun with an explicit --since=<date-or-sha>.`
      );
      process.exit(1);
    }
    return { logArgs: [`${cursor}..HEAD`], advanceCursor: true };
  }

  if (!latestEntry?.date) {
    console.error(
      'No changelog entries found to infer a starting date from, and no --since given. Pass --since=<date-or-sha> explicitly.'
    );
    process.exit(1);
  }

  return {
    logArgs: [`--since=${latestEntry.date}`, 'HEAD'],
    advanceCursor: true
  };
}

// Permissive on purpose - verified against this repo's real commit history,
// not the strict Conventional Commits spec: tolerates no-scope subjects
// (`seo: ...`), scopes containing spaces (`docs(coding skill): ...`), and
// comma-separated multi-scopes (`fix(analytics,observability): ...`).
const SUBJECT_RE = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/;

function parseCommits(logOutput: string): {
  parsed: ParsedCommit[];
  skipped: string[];
} {
  const parsed: ParsedCommit[] = [];
  const skipped: string[] = [];

  for (const line of logOutput.split('\n').filter(Boolean)) {
    const separatorIndex = line.indexOf('|');
    const subject = line.slice(separatorIndex + 1);
    const match = subject.match(SUBJECT_RE);
    if (!match) {
      skipped.push(subject);
      continue;
    }
    const [, type, , breakingMark, summary] = match;
    parsed.push({
      type: (type ?? '').toLowerCase(),
      breaking: Boolean(breakingMark),
      summary: summary ?? subject
    });
  }

  return { parsed, skipped };
}

function classify(parsed: ParsedCommit[]) {
  const buckets: Record<'New' | 'Fixed', string[]> = { New: [], Fixed: [] };
  let hasFeat = false;
  let hasBreaking = false;
  let noiseCount = 0;

  for (const commit of parsed) {
    if (commit.breaking) hasBreaking = true;
    if (commit.type === 'feat') hasFeat = true;

    const bucket = TYPE_BUCKETS[commit.type];
    if (!bucket || NOISE_TYPES.has(commit.type)) {
      noiseCount++;
      continue;
    }
    buckets[bucket].push(commit.summary);
  }

  return { buckets, hasFeat, hasBreaking, noiseCount };
}

// grep for `BREAKING CHANGE:` in commit bodies is a known, documented gap -
// `!` after the type is the only breaking signal this detects (see
// docs/warpkit/features/changelog.md).
function suggestVersion(
  current: string,
  hasFeat: boolean,
  hasBreaking: boolean
): string {
  const [majorRaw, minorRaw, patchRaw] = current.split('.');
  let major = Number.parseInt(majorRaw ?? '0', 10) || 0;
  let minor = Number.parseInt(minorRaw ?? '0', 10) || 0;
  let patch = Number.parseInt(patchRaw ?? '0', 10) || 0;

  if (hasBreaking) {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (hasFeat) {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

function suggestTags(hasFeat: boolean, hasBreaking: boolean): string[] {
  if (hasBreaking) return ['breaking'];
  if (hasFeat) return ['core'];
  return ['fix'];
}

async function main() {
  const sinceArg = process.argv
    .find(a => a.startsWith('--since='))
    ?.slice('--since='.length);

  const latestEntry = getLatestEntry();
  const { logArgs, advanceCursor } = resolveCommitRange(sinceArg, latestEntry);

  let logOutput: string;
  try {
    logOutput = git(['log', ...logArgs, '--pretty=format:%H|%s']);
  } catch (error) {
    console.error(
      'git log failed:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }

  if (!logOutput) {
    console.info('No commits found in range - nothing to draft.');
    return;
  }

  const { parsed, skipped } = parseCommits(logOutput);
  const { buckets, hasFeat, hasBreaking, noiseCount } = classify(parsed);

  console.info(
    `\n${parsed.length + skipped.length} commits in range: ${buckets.New.length + buckets.Fixed.length} reader-facing, ${noiseCount} noise (chore/test/style/ci/refactor/docs), ${skipped.length} unparseable.\n`
  );

  if (skipped.length > 0) {
    console.info(
      "Unparseable subjects (don't match Conventional Commits shape) - check these manually, nothing was silently dropped:"
    );
    for (const subject of skipped) console.info(`  - ${subject}`);
    console.info('');
  }

  const currentVersion = latestEntry?.version ?? '0.0.0';
  const suggestedVersion = suggestVersion(currentVersion, hasFeat, hasBreaking);
  const suggestedTags = suggestTags(hasFeat, hasBreaking);

  console.info(`Current version: ${latestEntry?.version ?? '(none)'}`);
  console.info(
    `Suggested next version: ${suggestedVersion}${hasBreaking ? ' (breaking change detected via a "!" in a commit type - grepping commit bodies for BREAKING CHANGE: is not done)' : ''}`
  );
  const version = prompt(`Version [${suggestedVersion}]: `) || suggestedVersion;
  const title = prompt('Title: ');
  if (!title) {
    console.error('Title is required.');
    process.exit(1);
  }

  const filePath = path.join(CHANGELOG_DIR, `v${version}.md`);
  if (existsSync(filePath)) {
    console.error(
      `${filePath} already exists - aborting rather than overwrite. Pick a different version.`
    );
    process.exit(1);
  }

  const bodyParts: string[] = [];
  if (buckets.New.length > 0) {
    bodyParts.push('## New\n', buckets.New.map(s => `- ${s}`).join('\n'));
  }
  if (buckets.Fixed.length > 0) {
    bodyParts.push(
      `${bodyParts.length > 0 ? '\n' : ''}## Fixed\n`,
      buckets.Fixed.map(s => `- ${s}`).join('\n')
    );
  }

  // version has no "v" prefix in frontmatter - the page template prepends
  // it at render (v{release.version}). The filename above does carry it.
  // Getting this backwards double-prefixes to "vv1.0.0" in the UI.
  const today = new Date().toISOString().slice(0, 10);
  const frontmatter = [
    '---',
    `version: "${version}"`,
    `date: "${today}"`,
    `title: "${title}"`,
    `tags: [${suggestedTags.map(t => `"${t}"`).join(', ')}]`,
    '---',
    ''
  ].join('\n');

  writeFileSync(filePath, `${frontmatter}${bodyParts.join('\n')}\n`);

  if (advanceCursor) {
    const head = git(['rev-parse', 'HEAD']);
    writeFileSync(CURSOR_PATH, `${head}\n`);
  }

  console.info(
    `\nWrote ${filePath} (DRAFT - bullets are raw commit subjects, not publishable copy).`
  );
  console.info(
    'Next: review/edit the file into real release-note prose, confirm the tags, then commit.'
  );
  if (!advanceCursor) {
    console.info(
      `--since was given, so ${CURSOR_PATH} was NOT updated - it still reflects the last bare \`make changelog.draft\` run.`
    );
  }
}

main();
