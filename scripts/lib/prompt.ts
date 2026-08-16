// Shared by the interactive setup scripts (setup-stripe.ts,
// setup-stripe-webhook.ts, setup-github-oauth.ts, generate-changelog.ts) -
// previously duplicated verbatim in each one.
import { readSync } from 'node:fs';

export function prompt(question: string): string {
  process.stdout.write(question);
  const buf = Buffer.alloc(4096);
  const n = readSync(0, buf, 0, 4096, null);
  return buf.subarray(0, n).toString().trim();
}
