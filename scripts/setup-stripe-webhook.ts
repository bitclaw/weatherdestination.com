// Creates (or repairs) the production Stripe webhook endpoint for this app
// and writes the resulting signing secret into the target env file.
//
// Idempotent by URL: lists existing webhook endpoints and reuses the one
// pointed at this app's webhook URL instead of creating a duplicate on every
// rerun. Stripe only returns an endpoint's signing secret once, at creation
// time -- list/retrieve calls never include it -- so if a matching endpoint
// already exists but the env file has no real secret on file (the exact
// failure mode this script exists to fix: an endpoint got created once,
// somewhere, and its secret was never captured), the only way to recover a
// usable secret is to delete and recreate the endpoint. This script asks
// before doing that.
//
// Local dev doesn't go through this script at all -- Stripe can't reach
// localhost, so `stripe listen --forward-to localhost:3000/api/v1/stripe-webhook`
// (see scripts/setup-stripe.ts's own note) is the right tool there, not a
// registered endpoint.
//
// Usage:
//   bun scripts/setup-stripe-webhook.ts [ENV_FILE]   # default: .env.production
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import Stripe from 'stripe';
import { config } from '@/config';
import { prompt } from './lib/prompt';

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

// Kept as a single source of truth here rather than importing from
// stripe.server.ts's switch statement -- that file is server-only
// (imports db, requireUser, etc.) and isn't meant to be imported from a
// standalone script. Whenever a new `case` is added there, add the matching
// event here too.
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'charge.refunded',
  'charge.dispute.created'
];

const sameEvents = (a: string[], b: string[]) =>
  a.length === b.length &&
  new Set(a).symmetricDifference(new Set(b)).size === 0;

async function main() {
  const ENV_PATH = process.argv[2] || '.env.production';
  console.info(`Target env file: ${ENV_PATH}\n`);

  if (!existsSync(ENV_PATH)) {
    console.error(
      `${ENV_PATH} not found. Run \`make stripe.setup ENV_FILE=${ENV_PATH}\` first -- it writes STRIPE_SECRET_KEY, which this script needs.`
    );
    process.exit(1);
  }

  const envContent = readFileSync(ENV_PATH, 'utf8');
  const secretKeyMatch = envContent.match(/^STRIPE_SECRET_KEY=(.+)$/m);
  const secretKey = secretKeyMatch?.[1];
  if (!secretKey || secretKey.includes('...')) {
    console.error(
      `No real STRIPE_SECRET_KEY in ${ENV_PATH}. Run \`make stripe.setup ENV_FILE=${ENV_PATH}\` first.`
    );
    process.exit(1);
  }

  const isLive = secretKey.startsWith('sk_live_');
  if (isLive) {
    console.info(
      'Using a LIVE Stripe key -- this registers a real webhook endpoint on your live account (not billable, but affects live traffic routing).'
    );
  }

  const stripe = new Stripe(secretKey);

  try {
    await stripe.balance.retrieve();
  } catch (error) {
    console.error(
      'Stripe auth failed:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }

  const webhookUrl = `https://${config.domainName}/api/v1/stripe-webhook`;
  console.info(`Webhook URL: ${webhookUrl}`);
  console.info(`Events: ${WEBHOOK_EVENTS.join(', ')}\n`);

  // Single page (100) is enough for a template project's own account, same
  // known limitation as setup-stripe.ts's product listing -- not meant for
  // accounts with hundreds of pre-existing webhook endpoints.
  const existingList = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = existingList.data.find(e => e.url === webhookUrl);

  const existingSecretMatch = envContent.match(/^STRIPE_WEBHOOK_SECRET=(.+)$/m);
  const existingSecret = existingSecretMatch?.[1];
  const hasRealSecret = existingSecret && !existingSecret.includes('...');

  let endpoint: Stripe.WebhookEndpoint;
  let secret: string | undefined;

  if (existing) {
    console.info(`Found existing endpoint ${existing.id} for this URL.`);

    if (!sameEvents(existing.enabled_events, WEBHOOK_EVENTS)) {
      console.info('Enabled events differ from this app -- updating them.');
      endpoint = await stripe.webhookEndpoints.update(existing.id, {
        enabled_events: WEBHOOK_EVENTS
      });
    } else {
      endpoint = existing;
    }

    if (hasRealSecret) {
      console.info(
        `${ENV_PATH} already has a real STRIPE_WEBHOOK_SECRET -- nothing more to do.`
      );
      return;
    }

    console.info(
      `\n${ENV_PATH} has no real STRIPE_WEBHOOK_SECRET on file, and Stripe never returns an` +
        "\nexisting endpoint's secret again after creation -- the only way to get a usable" +
        '\nsecret now is to delete this endpoint and recreate it at the same URL. That' +
        '\ninvalidates the old secret immediately (fine if nothing has a copy of it, which' +
        '\nis exactly this situation).'
    );
    const recreate = prompt('Delete and recreate this endpoint? [y/N] ');
    if (recreate.toLowerCase() !== 'y') {
      console.info(
        `Aborted. To recover the secret manually instead: https://dashboard.stripe.com/${isLive ? '' : 'test/'}webhooks/${endpoint.id} -> reveal signing secret -> paste into ${ENV_PATH} as STRIPE_WEBHOOK_SECRET.`
      );
      return;
    }

    await stripe.webhookEndpoints.del(endpoint.id);
    const created = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: WEBHOOK_EVENTS,
      description: `${config.appName} (recreated by scripts/setup-stripe-webhook.ts)`
    });
    endpoint = created;
    secret = created.secret;
    console.info(`Recreated as ${endpoint.id}.`);
  } else {
    const created = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: WEBHOOK_EVENTS,
      description: `${config.appName} (auto-created by scripts/setup-stripe-webhook.ts)`
    });
    endpoint = created;
    secret = created.secret;
    console.info(`Created endpoint ${endpoint.id}.`);
  }

  if (!secret) {
    // Should be unreachable given the branches above, but never write a
    // half-updated env file on an unexpected empty secret from Stripe.
    console.error(
      'Stripe did not return a signing secret for this endpoint. Nothing was written.'
    );
    process.exit(1);
  }

  const updatedEnv = upsertEnvVar(envContent, 'STRIPE_WEBHOOK_SECRET', secret);
  writeFileSync(ENV_PATH, updatedEnv);

  console.info(`\n${ENV_PATH} updated: STRIPE_WEBHOOK_SECRET.`);
  console.info(
    `Dashboard: https://dashboard.stripe.com/${isLive ? '' : 'test/'}webhooks/${endpoint.id}`
  );
}

main();
