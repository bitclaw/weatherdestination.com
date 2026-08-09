import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.info('  created .env from .env.example');
} else {
  console.info('  .env already exists, skipping');
}

const env = readFileSync('.env', 'utf8');

const needsSecret =
  /^BETTER_AUTH_SECRET=\s*$/m.test(env) ||
  /^BETTER_AUTH_SECRET=your-/m.test(env);

if (needsSecret) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Buffer.from(bytes).toString('hex');
  const updated = env.replace(/^(BETTER_AUTH_SECRET=).*$/m, `$1${secret}`);
  writeFileSync('.env', updated);
  console.info('  generated BETTER_AUTH_SECRET');
} else {
  console.info('  BETTER_AUTH_SECRET already set, skipping');
}

// Unlike BETTER_AUTH_SECRET (always present in .env.example, so a plain
// replace is enough), INDEXNOW_KEY may be entirely absent from an existing
// .env that predates this feature - append it in that case instead of
// silently no-op'ing on a replace that never matches.
const currentEnv = readFileSync('.env', 'utf8');
const hasIndexNowKeyLine = /^INDEXNOW_KEY=/m.test(currentEnv);
const needsIndexNowKey =
  !hasIndexNowKeyLine || /^INDEXNOW_KEY=\s*$/m.test(currentEnv);

if (needsIndexNowKey) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const key = Buffer.from(bytes).toString('hex');
  const updated = hasIndexNowKeyLine
    ? currentEnv.replace(/^(INDEXNOW_KEY=).*$/m, `$1${key}`)
    : `${currentEnv.trimEnd()}\nINDEXNOW_KEY=${key}\n`;
  writeFileSync('.env', updated);
  console.info('  generated INDEXNOW_KEY');
} else {
  console.info('  INDEXNOW_KEY already set, skipping');
}
