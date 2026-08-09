// Guided wizard for GitHub OAuth App setup.
//
// GitHub has no API/CLI to create an OAuth App (only GitHub Apps support the
// scriptable manifest flow) -- `gh` can't do this either. The one part that
// stays manual is clicking "Register application" on GitHub's own form. This
// script does everything around that: builds a pre-filled GitHub URL (name,
// homepage, callback all filled in), opens it, then writes the client
// id/secret you paste back into the right env file.
//
// Usage:
//   bun scripts/setup-github-oauth.ts --env=local   # -> .env, http://localhost:3000 callback
//   bun scripts/setup-github-oauth.ts --env=prod     # -> .env.production, https://<domain> callback

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { config } from '@/config';

function prompt(question: string): string {
  process.stdout.write(question);
  const buf = Buffer.alloc(4096);
  const n = readSync(0, buf, 0, 4096, null);
  return buf.subarray(0, n).toString().trim();
}

function upsertEnvVar(env: string, key: string, value: string): string {
  const uncommented = new RegExp(`^${key}=.*$`, 'm');
  if (uncommented.test(env)) {
    return env.replace(uncommented, `${key}=${value}`);
  }

  const commented = new RegExp(`^#\\s*${key}=.*$`, 'm');
  if (commented.test(env)) {
    return env.replace(commented, `${key}=${value}`);
  }

  const trimmed = env.replace(/\n+$/, '');
  return `${trimmed}\n${key}=${value}\n`;
}

function tryOpenBrowser(url: string) {
  const candidates: [string, string[]][] =
    process.platform === 'darwin'
      ? [['open', [url]]]
      : process.platform === 'win32'
        ? [['cmd.exe', ['/c', 'start', '""', url]]]
        : [
            // WSL: xdg-open usually isn't installed, but cmd.exe is always reachable.
            ['wslview', [url]],
            ['cmd.exe', ['/c', 'start', '""', url]],
            ['xdg-open', [url]]
          ];

  for (const [cmd, args] of candidates) {
    // Bun's spawn() reports ENOENT via an async 'error' event, not a sync
    // throw, so a missing executable would otherwise crash the process
    // instead of falling through to the next candidate. Check PATH first.
    if (!Bun.which(cmd)) continue;
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
    return true;
  }
  return false;
}

const envArg = process.argv
  .find(a => a.startsWith('--env='))
  ?.slice('--env='.length);

if (envArg !== 'local' && envArg !== 'prod') {
  console.error('Usage: bun scripts/setup-github-oauth.ts --env=local|prod');
  process.exit(1);
}

const isLocal = envArg === 'local';
const homepageUrl = isLocal
  ? 'http://localhost:3000'
  : `https://${config.domainName}`;
const callbackUrl = `${homepageUrl}/api/auth/callback/github`;
const appLabel = `${config.appName} (${isLocal ? 'local' : 'prod'})`;
const targetEnvPath = isLocal ? '.env' : '.env.production';

async function main() {
  if (!existsSync(targetEnvPath)) {
    console.error(
      `${targetEnvPath} not found. Run \`make init\` first (local) or create .env.production (prod).`
    );
    process.exit(1);
  }

  const envContent = readFileSync(targetEnvPath, 'utf8');
  const existingIdMatch = envContent.match(/^GITHUB_CLIENT_ID=(.+)$/m);
  const existingId = existingIdMatch?.[1];

  if (existingId && !existingId.includes('...')) {
    const reuse = prompt(
      `${targetEnvPath} already has GITHUB_CLIENT_ID=${existingId}. Overwrite with a new app? [y/N] `
    );
    if (reuse.toLowerCase() !== 'y') {
      console.info('Aborted -- existing value kept.');
      process.exit(0);
    }
  }

  const registerUrl = `https://github.com/settings/applications/new?${new URLSearchParams(
    { name: appLabel, url: homepageUrl, callback_url: callbackUrl }
  ).toString()}`;

  console.info(`\nOAuth App: ${appLabel}`);
  console.info(`  Homepage URL:          ${homepageUrl}`);
  console.info(`  Authorization callback: ${callbackUrl}\n`);

  const opened = tryOpenBrowser(registerUrl);
  console.info(
    opened
      ? 'Opened GitHub in your browser (form pre-filled). If nothing opened, use this link:'
      : "Couldn't auto-open a browser -- open this link:"
  );
  console.info(`  ${registerUrl}\n`);
  console.info(
    'On GitHub: click "Register application", then "Generate a new client secret".\n'
  );

  const clientId = prompt('Paste Client ID: ');
  if (!clientId) {
    console.error('No Client ID entered, aborting.');
    process.exit(1);
  }
  const clientSecret = prompt('Paste Client secret: ');
  if (!clientSecret) {
    console.error('No Client secret entered, aborting.');
    process.exit(1);
  }

  let updatedEnv = envContent;
  updatedEnv = upsertEnvVar(updatedEnv, 'GITHUB_CLIENT_ID', clientId);
  updatedEnv = upsertEnvVar(updatedEnv, 'GITHUB_CLIENT_SECRET', clientSecret);
  updatedEnv = upsertEnvVar(updatedEnv, 'VITE_GITHUB_CLIENT_ID', clientId);
  writeFileSync(targetEnvPath, updatedEnv);

  console.info(
    `\n${targetEnvPath} updated: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, VITE_GITHUB_CLIENT_ID.`
  );
  if (!isLocal) {
    console.info(
      'Prod env changed locally only -- run `make deploy.env` to ship it to the server.'
    );
  }
}

main();
