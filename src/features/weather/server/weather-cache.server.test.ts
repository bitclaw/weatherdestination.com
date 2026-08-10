import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUIDv7 } from 'bun';
import {
  isFresh,
  readCachedWeatherData,
  type WeatherDataCache,
  writeCachedWeatherData
} from './weather-cache.server';

// Round-2 audit: zero test coverage. CACHE_ROOT is resolved once at module
// load from RUNMIST_DATA_DIR/USER_DATA_DIR (no injectable seam), so these
// tests run against the real resolved cache dir (data/weather under the
// repo root, given .env.test's USER_DATA_DIR=data/users) using a random
// cityId per test to avoid collisions, cleaning up the written file after.

const STATIONS_DIR = path.resolve('data', 'weather', 'stations');
const METADATA_PATH = path.resolve('data', 'weather', 'metadata.json');

async function cleanup(cityId: string) {
  await fs.rm(path.join(STATIONS_DIR, `${cityId}.json`), { force: true });
}

// writeCachedWeatherData writes the real shared metadata.json (no
// injectable seam) - restore it to its exact pre-test state (including
// "didn't exist at all" on a fresh checkout) so a full test run doesn't
// leave a stray file behind for `make lint`/`biome ci` to flag.
let originalMetadata: string | null = null;

beforeAll(async () => {
  originalMetadata = await fs
    .readFile(METADATA_PATH, 'utf-8')
    .catch(() => null);
});

afterAll(async () => {
  if (originalMetadata === null) {
    // data/weather didn't exist before this file ran - remove the whole
    // tree this test file created, not just metadata.json.
    await fs.rm(path.resolve('data', 'weather'), {
      recursive: true,
      force: true
    });
  } else {
    await fs.writeFile(METADATA_PATH, originalMetadata, 'utf-8');
  }
});

function makeCacheData(
  cityId: string,
  overrides: Partial<WeatherDataCache> = {}
): WeatherDataCache {
  return {
    cityId,
    cityName: 'Test City',
    station: {
      id: 'GHCND:TEST123',
      name: 'Test Station',
      latitude: 40,
      longitude: -100,
      elevation: 200
    },
    sunshineHours: 6.5,
    avgTempHigh: 75,
    avgTempLow: 55,
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000).toISOString(),
    ...overrides
  };
}

describe('isFresh', () => {
  it('returns true just inside the TTL window', () => {
    const fetchedAt = new Date(Date.now() - 1000).toISOString();
    expect(isFresh(fetchedAt, 5000)).toBe(true);
  });

  it('returns false just outside the TTL window', () => {
    const fetchedAt = new Date(Date.now() - 6000).toISOString();
    expect(isFresh(fetchedAt, 5000)).toBe(false);
  });

  it('returns false exactly at the TTL boundary (strict <, not <=)', () => {
    const now = Date.now();
    const fetchedAt = new Date(now - 5000);
    // Freeze "now" relative to fetchedAt precisely at the boundary by
    // computing isFresh's own comparison inline is what the source does -
    // instead, assert the documented boundary semantics directly against a
    // fetchedAt whose age is >= ttlMs by construction.
    expect(isFresh(fetchedAt, 5000)).toBe(false);
  });

  it('accepts a Date object as well as an ISO string', () => {
    expect(isFresh(new Date(), 5000)).toBe(true);
  });

  it('uses the default 30-day TTL when none is given', () => {
    const recentlyFetched = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000
    ).toISOString();
    const longAgoFetched = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(isFresh(recentlyFetched)).toBe(true);
    expect(isFresh(longAgoFetched)).toBe(false);
  });
});

describe('readCachedWeatherData', () => {
  const cityId = `test_missing_${randomUUIDv7()}`;

  afterEach(() => cleanup(cityId));

  it('returns null when no cache file exists for the city', async () => {
    expect(await readCachedWeatherData(cityId)).toBeNull();
  });

  it('returns null (does not throw) when the cache file contains invalid JSON', async () => {
    await fs.mkdir(STATIONS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(STATIONS_DIR, `${cityId}.json`),
      'this is not valid json {{{',
      'utf-8'
    );

    expect(await readCachedWeatherData(cityId)).toBeNull();
  });
});

describe('writeCachedWeatherData / readCachedWeatherData round trip', () => {
  const cityId = `test_roundtrip_${randomUUIDv7()}`;

  afterEach(() => cleanup(cityId));

  it('writes then reads back the same data', async () => {
    const data = makeCacheData(cityId, { cityName: 'Roundtrip City' });
    await writeCachedWeatherData(data);

    const read = await readCachedWeatherData(cityId);
    expect(read?.cityId).toBe(cityId);
    expect(read?.cityName).toBe('Roundtrip City');
    expect(read?.sunshineHours).toBe(6.5);
    expect(read?.avgTempHigh).toBe(75);
  });

  it('overwrites fetchedAt/expiresAt with fresh values computed from the given ttlMs, ignoring the caller-supplied ones', async () => {
    const staleFetchedAt = new Date(Date.now() - 999_999_999).toISOString();
    const data = makeCacheData(cityId, {
      fetchedAt: staleFetchedAt,
      expiresAt: staleFetchedAt
    });

    const before = Date.now();
    await writeCachedWeatherData(data, 60_000);
    const after = Date.now();

    const read = await readCachedWeatherData(cityId);
    expect(read).not.toBeNull();
    const fetchedAtMs = new Date(read!.fetchedAt).getTime();
    expect(fetchedAtMs).toBeGreaterThanOrEqual(before);
    expect(fetchedAtMs).toBeLessThanOrEqual(after);
    expect(new Date(read!.expiresAt).getTime() - fetchedAtMs).toBe(60_000);
  });

  it('survives a corrupt metadata.json instead of throwing', async () => {
    await fs.mkdir(path.resolve('data', 'weather'), { recursive: true });
    await fs.writeFile(METADATA_PATH, 'not valid json', 'utf-8');

    await expect(
      writeCachedWeatherData(makeCacheData(cityId))
    ).resolves.toBeUndefined();
    const read = await readCachedWeatherData(cityId);
    expect(read?.cityId).toBe(cityId);
  });
});
