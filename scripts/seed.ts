import { randomUUIDv7 } from 'bun';
import { db } from '@/lib/db/index.ts';
import { cities, featureFlags } from '@/lib/db/schema.ts';
import { citySeeds } from '@/lib/db/seed-data/cities.ts';

type FlagSeed = {
  flag: string;
  enabled: boolean;
};

const FLAGS: FlagSeed[] = [{ flag: 'cookie_consent_enabled', enabled: false }];

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
