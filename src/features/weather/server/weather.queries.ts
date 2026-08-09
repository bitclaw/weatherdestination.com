import { err, ok, type Result } from '@bitclaw/result';
import { createServerFn } from '@tanstack/react-start';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { ERROR_CODES } from '@/lib/constants';
import { db } from '@/lib/db';
import { cities } from '@/lib/db/schema';
import { createRateLimiter, getClientIP } from '@/server/rate-limit';
import { isFresh, readCachedWeatherData } from './weather-cache.server';

type CityListRow = {
  id: string;
  name: string;
  state: string;
  stateCode: string;
  population: number | null;
};

export const listCitiesFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Result<CityListRow[]>> => {
    const rows = await db.query.cities.findMany({
      columns: {
        id: true,
        name: true,
        state: true,
        stateCode: true,
        population: true
      },
      orderBy: (city, { asc }) => [asc(city.state), asc(city.name)]
    });
    return ok(rows);
  }
);

const compareSchema = z.object({
  cityIds: z.array(z.string()).min(2).max(5)
});

// Public, unauthenticated endpoint - a compare request on cache-miss cities
// can trigger NOAA fetches, so it's rate-limited like the other pre-auth
// public endpoints (lead.ts, email-validation.mutations.ts). The file cache
// makes repeat requests for the same city free, so this only really bites
// cold misses / scraping.
const limiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  failClosedOnUnknownIp: true
});

export const compareCitiesFn = createServerFn({ method: 'GET' })
  .validator(compareSchema)
  .handler(async ({ data }) => {
    if (limiter.check(getClientIP() ?? undefined)) {
      return err(
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Try again later.'
      );
    }

    const rows = await db.query.cities.findMany({
      where: inArray(cities.id, data.cityIds)
    });
    if (rows.length === 0) {
      return err(ERROR_CODES.NOT_FOUND, 'No cities found');
    }

    // Best-effort NOAA refresh for stale/never-fetched cities. Only runs
    // when a token is configured - without one, serve the seeded
    // placeholder values as-is rather than failing the request.
    if (process.env.NOAA_API_TOKEN) {
      const { updateCityWeatherData } = await import('./noaa.server');
      await Promise.all(
        rows.map(async city => {
          const cached = await readCachedWeatherData(city.id);
          if (!cached || !isFresh(cached.fetchedAt)) {
            await updateCityWeatherData(city.id);
          }
        })
      );
      const refreshed = await db.query.cities.findMany({
        where: inArray(cities.id, data.cityIds)
      });
      return ok(refreshed);
    }

    return ok(rows);
  });
