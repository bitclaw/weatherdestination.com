import { randomUUIDv7 } from 'bun';
import { db } from '@/lib/db/index.ts';
import { cities, featureFlags } from '@/lib/db/schema.ts';
import { citySeeds } from '@/lib/db/seed-data/cities.ts';

type FlagSeed = {
  flag: string;
  enabled: boolean;
};

const FLAGS: FlagSeed[] = [
  { flag: 'cookie_consent_enabled', enabled: false },
  // Demo/example features: all off. Dashboard purpose for this product
  // isn't decided yet - default everything off rather than exposing
  // template scaffolding (Notes/Chat/API Keys/Apps/Audit Log/Uploads)
  // before there's a real plan for what this dashboard is for. Flip one on
  // via /dashboard/admin/feature-flags once repurposed for real use.
  { flag: 'notes_enabled', enabled: false },
  { flag: 'ai_chat_enabled', enabled: false },
  { flag: 'api_keys_enabled', enabled: false },
  { flag: 'credits_enabled', enabled: false },
  { flag: 'feature_requests_enabled', enabled: false },
  { flag: 'apps_enabled', enabled: false },
  { flag: 'audit_log_enabled', enabled: false },
  { flag: 'uploads_enabled', enabled: false }
];

const now = new Date();

for (const { flag, enabled } of FLAGS) {
  db.insert(featureFlags)
    .values({
      id: randomUUIDv7(),
      flag,
      enabled,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoNothing({ target: featureFlags.flag })
    .run();
}

console.info(`Seeded ${FLAGS.length} feature flag(s).`);

for (const city of citySeeds) {
  db.insert(cities)
    .values({
      id: randomUUIDv7(),
      ...city,
      createdAt: now
    })
    .onConflictDoNothing({ target: [cities.name, cities.stateCode] })
    .run();
}

console.info(`Seeded ${citySeeds.length} city/cities.`);
