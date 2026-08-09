// JSON file cache for NOAA weather data, ported from the pre-rewrite site's
// app/utils/cache/weather-cache.server.ts. Cache-first: avoids re-fetching
// NOAA's climate normals API (5 req/sec limit) on every request.
import fs from 'node:fs/promises';
import path from 'node:path';

// Same RUNMIST_DATA_DIR/USER_DATA_DIR precedence as getUserDbPath in
// src/lib/db/user-db.ts, but under weather/ instead of users/ - this cache
// is shared reference data, not per-user.
const CACHE_ROOT = path.resolve(
  process.env.RUNMIST_DATA_DIR
    ? path.join(process.env.RUNMIST_DATA_DIR, 'weather')
    : process.env.USER_DATA_DIR
      ? path.join(process.env.USER_DATA_DIR, '..', 'weather')
      : path.join('data', 'weather')
);
const STATIONS_DIR = path.join(CACHE_ROOT, 'stations');
const METADATA_FILE = path.join(CACHE_ROOT, 'metadata.json');

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type WeatherDataCache = {
  cityId: string;
  cityName: string;
  station: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    elevation: number;
  } | null;
  sunshineHours: number | null;
  avgTempHigh: number | null;
  avgTempLow: number | null;
  fetchedAt: string;
  expiresAt: string;
};

type CacheMetadata = {
  version: string;
  lastUpdated: string | null;
  cities: Record<
    string,
    { name: string; fetchedAt: string; expiresAt: string }
  >;
};

async function readMetadata(): Promise<CacheMetadata> {
  try {
    const data = await fs.readFile(METADATA_FILE, 'utf-8');
    return JSON.parse(data) as CacheMetadata;
  } catch {
    return { version: '1.0.0', lastUpdated: null, cities: {} };
  }
}

async function writeMetadata(metadata: CacheMetadata): Promise<void> {
  await fs.mkdir(CACHE_ROOT, { recursive: true });
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
}

export const isFresh = (
  fetchedAt: string | Date,
  ttlMs: number = DEFAULT_TTL_MS
): boolean => {
  const fetchTime =
    typeof fetchedAt === 'string' ? new Date(fetchedAt) : fetchedAt;
  return Date.now() - fetchTime.getTime() < ttlMs;
};

export const readCachedWeatherData = async (
  cityId: string
): Promise<WeatherDataCache | null> => {
  try {
    const filePath = path.join(STATIONS_DIR, `${cityId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as WeatherDataCache;
  } catch {
    return null;
  }
};

export const writeCachedWeatherData = async (
  data: WeatherDataCache,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> => {
  await fs.mkdir(STATIONS_DIR, { recursive: true });

  const now = new Date();
  const cacheData: WeatherDataCache = {
    ...data,
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString()
  };

  await fs.writeFile(
    path.join(STATIONS_DIR, `${data.cityId}.json`),
    JSON.stringify(cacheData, null, 2),
    'utf-8'
  );

  const metadata = await readMetadata();
  metadata.cities[data.cityId] = {
    name: data.cityName,
    fetchedAt: cacheData.fetchedAt,
    expiresAt: cacheData.expiresAt
  };
  metadata.lastUpdated = now.toISOString();
  await writeMetadata(metadata);
};
