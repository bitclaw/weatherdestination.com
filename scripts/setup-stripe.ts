// Interactive wizard: creates Stripe test-mode products/prices matching the
// plans defined in config.ts, then writes the resulting price IDs into .env.
//
// Idempotent via Stripe Price `lookup_key` (strongly consistent reads, unlike
// the eventually-consistent Search API) -- reruns detect existing prices
// instead of creating duplicates.
//
// Known limitation: product reuse lists only the first page (100) of
// products and matches client-side on metadata.warpkit_plan. Fine for a
// template project's own Stripe account; not meant for accounts with
// hundreds of pre-existing products.
import { existsSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import Stripe from 'stripe';
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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type PriceTarget = {
  lookupKey: string;
  productName: string;
  planKey: string;
  unitAmount: number;
  interval?: 'month' | 'year';
  envVar: string;
};

async function main() {
  // Pass a path (make stripe.setup ENV_FILE=.env.production) to skip the
  // prompt for non-interactive use; otherwise ask each run so a rerun with
  // a different key (e.g. live) doesn't silently overwrite .env.
  const ENV_PATH =
    process.argv[2] || prompt('Env file to write to [.env]: ') || '.env';
  console.info(`Target env file: ${ENV_PATH}\n`);
  const envContent = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';

  const existingKeyMatch = envContent.match(/^STRIPE_SECRET_KEY=(.+)$/m);
  const existingKey = existingKeyMatch?.[1];
  const hasRealExistingKey = existingKey && !existingKey.includes('...');

  let secretKey: string;
  if (hasRealExistingKey) {
    const reuse = prompt(
      `Found STRIPE_SECRET_KEY in .env (${existingKey!.slice(0, 12)}...). Use it? [Y/n] `
    );
    if (reuse.toLowerCase() === 'n') {
      console.info(
        'Get a test-mode secret key from https://dashboard.stripe.com/test/apikeys (starts with sk_test_).'
      );
      secretKey = prompt('Paste Stripe secret key: ');
    } else {
      secretKey = existingKey!;
    }
  } else {
    console.info(
      'Get a test-mode secret key from https://dashboard.stripe.com/test/apikeys (starts with sk_test_).'
    );
    secretKey = prompt(
      'Paste Stripe secret key (sk_test_... or sk_live_...): '
    );
  }

  if (secretKey.startsWith('sk_live_')) {
    const confirm = prompt(
      'WARNING: this is a LIVE key -- running this creates real billable products. Type "yes-live" to continue: '
    );
    if (confirm !== 'yes-live') {
      console.error('Aborted.');
      process.exit(1);
    }
  } else if (!secretKey.startsWith('sk_test_')) {
    console.error(
      'Key does not look like a Stripe secret key (expected sk_test_... or sk_live_...).'
    );
    process.exit(1);
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

  const targets: PriceTarget[] = [];

  for (const plan of config.stripe.plans) {
    if (plan.recurring) {
      targets.push({
        lookupKey: `warpkit_${plan.id}_month`,
        productName: plan.name,
        planKey: plan.id,
        unitAmount: Math.round(plan.recurring.price * 100),
        interval: 'month',
        envVar: `VITE_STRIPE_${plan.id.toUpperCase()}_PRICE_ID`
      });
      if (plan.recurring.yearlyPrice) {
        targets.push({
          lookupKey: `warpkit_${plan.id}_year`,
          productName: plan.name,
          planKey: plan.id,
          unitAmount: Math.round(plan.recurring.yearlyPrice * 100),
          interval: 'year',
          envVar: `VITE_STRIPE_${plan.id.toUpperCase()}_YEARLY_PRICE_ID`
        });
      }
    }
    if (plan.oneTime) {
      targets.push({
        lookupKey: `warpkit_${plan.id}_onetime`,
        productName: `${plan.name} (one-time)`,
        planKey: plan.id,
        unitAmount: Math.round(plan.oneTime.price * 100),
        envVar: 'VITE_STRIPE_ONE_TIME_PRICE_ID'
      });
    }
  }

  if (config.credits.enabled) {
    const topUpInput = prompt(
      `Credits top-up price for ${config.credits.creditsPerTopUp} credits [$${config.credits.topUpPrice}]: `
    );
    const topUpPrice = topUpInput
      ? Number(topUpInput)
      : config.credits.topUpPrice;
    targets.push({
      lookupKey: 'warpkit_credits_topup',
      productName: `${config.credits.creditsPerTopUp} Credits`,
      planKey: 'credits',
      unitAmount: Math.round(topUpPrice * 100),
      envVar: 'VITE_STRIPE_CREDITS_PRICE_ID'
    });
  }

  const existingByLookupKey = new Map<string, Stripe.Price>();
  for (const batch of chunk(
    targets.map(t => t.lookupKey),
    10
  )) {
    const result = await stripe.prices.list({ lookup_keys: batch, limit: 10 });
    for (const price of result.data) {
      if (price.lookup_key) existingByLookupKey.set(price.lookup_key, price);
    }
  }

  const productList = await stripe.products.list({ limit: 100 });
  const productCache = new Map<string, Stripe.Product>();
  for (const product of productList.data) {
    const planKey = product.metadata?.warpkit_plan;
    if (planKey && !productCache.has(planKey))
      productCache.set(planKey, product);
  }

  async function getOrCreateProduct(
    planKey: string,
    name: string
  ): Promise<Stripe.Product> {
    const cached = productCache.get(planKey);
    if (cached) return cached;
    const created = await stripe.products.create({
      name,
      metadata: { warpkit_plan: planKey }
    });
    productCache.set(planKey, created);
    return created;
  }

  const resolved: Record<string, string> = {};

  for (const target of targets) {
    const existing = existingByLookupKey.get(target.lookupKey);
    if (existing) {
      const existingAmount = existing.unit_amount ?? 0;
      if (existingAmount !== target.unitAmount) {
        console.warn(
          `\n${target.lookupKey}: existing price is ${fmt(existingAmount)}, config.ts wants ${fmt(target.unitAmount)}.`
        );
        const answer = prompt(
          `Reuse existing price ${existing.id} anyway? [y/N] `
        );
        if (answer.toLowerCase() !== 'y') {
          console.error(
            `Skipped ${target.lookupKey} -- resolve the mismatch in Stripe or config.ts and rerun.`
          );
          continue;
        }
      } else {
        console.info(
          `${target.lookupKey}: reusing existing price ${existing.id} (${fmt(existingAmount)})`
        );
      }
      resolved[target.envVar] = existing.id;
      continue;
    }

    const product = await getOrCreateProduct(
      target.planKey,
      target.productName
    );
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: target.unitAmount,
      currency: 'usd',
      lookup_key: target.lookupKey,
      ...(target.interval ? { recurring: { interval: target.interval } } : {})
    });
    console.info(
      `Created price ${price.id} for ${target.lookupKey} (${fmt(target.unitAmount)})`
    );
    resolved[target.envVar] = price.id;
  }

  let updatedEnv = envContent;
  updatedEnv = upsertEnvVar(updatedEnv, 'STRIPE_SECRET_KEY', secretKey);
  for (const [key, value] of Object.entries(resolved)) {
    updatedEnv = upsertEnvVar(updatedEnv, key, value);
  }
  writeFileSync(ENV_PATH, updatedEnv);

  console.info('\n.env updated. Summary:');
  for (const [key, value] of Object.entries(resolved)) {
    console.info(
      `  ${key}=${value}  https://dashboard.stripe.com/${secretKey.startsWith('sk_live_') ? '' : 'test/'}prices/${value}`
    );
  }
  const isLive = secretKey.startsWith('sk_live_');
  console.info(
    isLive
      ? `\nNote: STRIPE_WEBHOOK_SECRET is not set by this script. For a LIVE key,\n` +
          `get it from the Dashboard, not the CLI:\n` +
          `  https://dashboard.stripe.com/webhooks -> add endpoint\n` +
          `  https://yourdomain/api/v1/stripe-webhook -> copy the signing secret\n` +
          `into ${ENV_PATH}. (\`stripe listen\` only forwards test-mode events --\n` +
          `it will not give you a usable secret here.)`
      : '\nNote: STRIPE_WEBHOOK_SECRET is not set by this script. For local dev\n' +
          'against this TEST key, run:\n' +
          '  stripe listen --forward-to localhost:3000/api/v1/stripe-webhook\n' +
          `and paste the printed whsec_... into ${ENV_PATH}. That secret is\n` +
          "ephemeral (new each run) and CLI-session-scoped -- it's for local\n" +
          'forwarding only, not for a deployed webhook endpoint.\n\n' +
          'If that command fails with an "Expired API Key" / authentication error,\n' +
          "that's the Stripe CLI's OWN separate login, not the STRIPE_SECRET_KEY in\n" +
          `${ENV_PATH} -- run \`stripe login\` to re-authenticate the CLI, then retry.`
  );
}

main();
