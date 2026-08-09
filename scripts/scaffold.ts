import { mkdirSync, readSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

const TARGET = process.argv[2];
const FORCE = process.env.FORCE === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
const BOOTSTRAP = process.env.BOOTSTRAP !== '0';
const OVERWRITE_PROTECTED = process.env.OVERWRITE_PROTECTED === '1';

if (!TARGET) {
  console.error('Usage: bun scripts/scaffold.ts <target-directory>');
  process.exit(1);
}

const WARPKIT_ROOT = resolve(import.meta.dir, '..');
const TARGET_ABS = resolve(TARGET);

// Files users typically customize , skipped by default on re-scaffold.
// Add to this list as the "first things to change" surface grows.
const PROTECTED_FILES = new Set(['config.ts', 'src/styles.css']);

const tryStat = (p: string) => {
  try {
    return statSync(p);
  } catch {
    return null;
  }
};

if (!tryStat(TARGET_ABS)?.isDirectory()) {
  console.error(
    `Error: TARGET does not exist or is not a directory: ${TARGET_ABS}`
  );
  process.exit(1);
}

if (TARGET_ABS === WARPKIT_ROOT) {
  console.error('Error: TARGET cannot be the warpkit source directory itself.');
  process.exit(1);
}
if (TARGET_ABS.startsWith(WARPKIT_ROOT + sep)) {
  console.error(
    'Error: TARGET cannot be a subdirectory of the warpkit source.'
  );
  process.exit(1);
}
if (WARPKIT_ROOT.startsWith(TARGET_ABS + sep)) {
  console.error(
    'Error: TARGET cannot be a parent of the warpkit source (would cause recursive copy).'
  );
  process.exit(1);
}

if (!tryStat(`${TARGET_ABS}/.git`)?.isDirectory()) {
  console.warn('Warning: TARGET has no .git; files will still scaffold.');
}

const lsResult = Bun.spawnSync(['git', 'ls-files'], {
  cwd: WARPKIT_ROOT,
  stdout: 'pipe',
  stderr: 'pipe'
});
if (lsResult.exitCode !== 0) {
  console.error('Error: failed to enumerate source files via git ls-files');
  console.error(new TextDecoder().decode(lsResult.stderr));
  process.exit(1);
}

const EXCLUDED_FILES = new Set(['.env']);
const EXCLUDED_PREFIXES = [
  'data/',
  'node_modules/',
  '.output/',
  'dist/',
  '.nitro/',
  '.tanstack/',
  '.content-collections/',
  '.git/'
];

const allFiles = new TextDecoder()
  .decode(lsResult.stdout)
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter(
    f => !EXCLUDED_FILES.has(f) && !EXCLUDED_PREFIXES.some(p => f.startsWith(p))
  );

// Split: protected files (skipped by default) vs files to copy
const skippedProtected: string[] = [];
const filesToCopy: string[] = [];

for (const file of allFiles) {
  const isProtected = PROTECTED_FILES.has(file) && !OVERWRITE_PROTECTED;
  if (isProtected && (await Bun.file(`${TARGET_ABS}/${file}`).exists())) {
    skippedProtected.push(file);
  } else {
    filesToCopy.push(file);
  }
}

// Conflict detection only on filesToCopy
const conflicts: string[] = [];
for (const file of filesToCopy) {
  if (await Bun.file(`${TARGET_ABS}/${file}`).exists()) {
    conflicts.push(file);
  }
}

const conflictLine =
  conflicts.length === 0
    ? 'none'
    : conflicts
        .slice(0, 5)
        .map(f =>
          f === 'bun.lock' ? 'bun.lock ← overwrites target lockfile' : f
        )
        .join(', ') +
      (conflicts.length > 5 ? `, +${conflicts.length - 5} more` : '');

console.info(`Files to copy:     ${filesToCopy.length}`);
console.info(`Conflicts:         ${conflicts.length}  (${conflictLine})`);
if (skippedProtected.length > 0) {
  console.info(
    `Protected skipped: ${skippedProtected.length}  (${skippedProtected.join(', ')} , pass OVERWRITE_PROTECTED=1 to overwrite)`
  );
}

if (DRY_RUN) {
  console.info(
    `Bootstrap:         ${BOOTSTRAP ? 'yes (init-env → bun install → db:migrate)' : 'no'}`
  );
  console.info('\nDRY RUN , no files written.');
  process.exit(0);
}

if (conflicts.length > 0 && !FORCE) {
  if (!process.stdin.isTTY) {
    console.error(
      'Error: conflicts exist but stdin is not a TTY. Re-run with FORCE=1 to overwrite.'
    );
    process.exit(1);
  }

  console.info(
    `\nThe following ${conflicts.length} file(s) already exist in ${TARGET_ABS}:`
  );
  for (const c of conflicts) {
    const note = c === 'bun.lock' ? '  ← overwrites target lockfile' : '';
    console.info(`  ${c}${note}`);
  }

  process.stdout.write('\nProceed and overwrite? [y/N] ');
  const buf = Buffer.alloc(256);
  const n = readSync(0, buf, 0, 256, null);
  const answer = buf.subarray(0, n).toString().trim().toLowerCase();
  if (answer !== 'y' && answer !== 'yes') {
    console.info('Aborted.');
    process.exit(0);
  }
}

let copied = 0;
for (const file of filesToCopy) {
  const dest = `${TARGET_ABS}/${file}`;
  mkdirSync(dirname(dest), { recursive: true });
  await Bun.write(dest, Bun.file(`${WARPKIT_ROOT}/${file}`));
  copied++;
}

if (BOOTSTRAP) {
  console.info('\nRunning bootstrap...\n');

  const steps = [
    { label: 'init-env', cmd: ['bun', 'scripts/init-env.ts'] },
    { label: 'bun install', cmd: ['bun', 'install', '--frozen-lockfile'] },
    { label: 'db:migrate', cmd: ['bun', 'run', 'db:migrate'] }
  ];

  for (const step of steps) {
    const result = Bun.spawnSync(step.cmd, {
      cwd: TARGET_ABS,
      stdout: 'inherit',
      stderr: 'inherit'
    });
    if (result.exitCode !== 0) {
      console.error(`\n${step.label} failed. Fix errors and re-run manually.`);
      process.exit(1);
    }
  }
}

console.info(`
  Done.

  Copied:            ${copied} files into ${TARGET_ABS}${skippedProtected.length > 0 ? `\n  Skipped protected: ${skippedProtected.length} files (${skippedProtected.join(', ')})` : ''}

  Next steps:
  1. cd ${TARGET_ABS}
  2. Edit config.ts        -- set appName, domainName, Stripe plans
  3. Fill in .env          -- Stripe keys, Resend key, ADMIN_EMAILS
  4. Set Stripe webhook    -- https://yourdomain/api/v1/stripe-webhook
  5. make dev
`);
