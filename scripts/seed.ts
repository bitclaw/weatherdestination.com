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
  // Demo/example features: default off. They exist to show working
  // patterns (per-user CRUD, LLM chat, API key issuance, metered credits,
  // community voting), not to be live for every fresh signup - flip one on
  // via /dashboard/admin/feature-flags to explore it.
  { flag: 'notes_enabled', enabled: false },
  { flag: 'ai_chat_enabled', enabled: false },
  { flag: 'api_keys_enabled', enabled: false },
  { flag: 'credits_enabled', enabled: false },
  { flag: 'feature_requests_enabled', enabled: false }
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
