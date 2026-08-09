// NOAA Climate Data Online (CDO) API client, ported from the pre-rewrite
// site's app/utils/data-scrapers/noaa.server.ts. Docs:
// https://www.ncdc.noaa.gov/cdo-web/webservices/v2
//
// Cache-first: check the JSON file cache (weather-cache.server.ts) before
// hitting NOAA, since the API is rate-limited to 5 req/sec.
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { cities } from '@/lib/db/schema';
import { createLogger } from '@/lib/logger';
import {
  isFresh,
  readCachedWeatherData,
  type WeatherDataCache,
  writeCachedWeatherData
} from './weather-cache.server';

const log = createLogger({ module: 'noaa' });

const NOAA_API_BASE = 'https://www.ncdc.noaa.gov/cdo-web/api/v2';

type NOAAStation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
};

type NOAADataPoint = {
  date: string;
  datatype: string;
  station: string;
  value: number;
};

async function fetchNOAAData<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const token = process.env.NOAA_API_TOKEN;
  if (!token) {
    throw new Error(
      'NOAA_API_TOKEN environment variable is required. Get your token at: https://www.ncdc.noaa.gov/cdo-web/token'
    );
  }

  const url = new URL(`${NOAA_API_BASE}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, String(value));
  }

  const response = await fetch(url.toString(), { headers: { token } });
  if (!response.ok) {
    throw new Error(
      `NOAA API error: ${response.status} ${response.statusText}`
    );
  }
  return (await response.json()) as T;
}

export const findNearestStation = async (
  latitude: number,
  longitude: number
): Promise<NOAAStation | null> => {
  try {
    const response = await fetchNOAAData<{ results: NOAAStation[] }>(
      '/stations',
      {
        extent: `${latitude - 0.5},${longitude - 0.5},${latitude + 0.5},${longitude + 0.5}`,
        limit: 1,
        datasetid: 'NORMAL_DLY'
      }
    );
    return response.results?.[0] || null;
  } catch (error: unknown) {
    log.error({ err: error }, 'Error finding nearest station');
    return null;
  }
};

export const fetchSunshineHours = async (
  stationId: string
): Promise<number | null> => {
  try {
    const response = await fetchNOAAData<{ results: NOAADataPoint[] }>(
      '/data',
      {
        datasetid: 'NORMAL_DLY',
        stationid: stationId,
        datatypeid: 'DLY-CLDD-NORMAL',
        startdate: '2010-01-01',
        enddate: '2010-12-31',
        limit: 365
      }
    );
    if (!response.results || response.results.length === 0) return null;
    const total = response.results.reduce((sum, p) => sum + p.value, 0);
    return total / response.results.length;
  } catch (error: unknown) {
    log.error({ err: error }, 'Error fetching sunshine hours');
    return null;
  }
};

export const fetchTemperatureNormals = async (
  stationId: string
): Promise<{ avgTempHigh: number | null; avgTempLow: number | null }> => {
  try {
    const [highResponse, lowResponse] = await Promise.all([
      fetchNOAAData<{ results: NOAADataPoint[] }>('/data', {
        datasetid: 'NORMAL_DLY',
        stationid: stationId,
        datatypeid: 'DLY-TMAX-NORMAL',
        startdate: '2010-01-01',
        enddate: '2010-12-31',
        limit: 365
      }),
      fetchNOAAData<{ results: NOAADataPoint[] }>('/data', {
        datasetid: 'NORMAL_DLY',
        stationid: stationId,
        datatypeid: 'DLY-TMIN-NORMAL',
        startdate: '2010-01-01',
        enddate: '2010-12-31',
        limit: 365
      })
    ]);

    // NOAA returns tenths of degrees C
    const avgHighC = highResponse.results?.length
      ? highResponse.results.reduce((sum, p) => sum + p.value, 0) /
        highResponse.results.length /
        10
      : null;
    const avgLowC = lowResponse.results?.length
      ? lowResponse.results.reduce((sum, p) => sum + p.value, 0) /
        lowResponse.results.length /
        10
      : null;

    return {
      avgTempHigh: avgHighC !== null ? (avgHighC * 9) / 5 + 32 : null,
      avgTempLow: avgLowC !== null ? (avgLowC * 9) / 5 + 32 : null
    };
  } catch (error: unknown) {
    log.error({ err: error }, 'Error fetching temperature normals');
    return { avgTempHigh: null, avgTempLow: null };
  }
};

// Cache-first refresh of one city's weather columns. Returns false on
// failure (city missing, no nearby station, NOAA error) without throwing -
// callers treat a stale/unrefreshed city as non-fatal.
export const updateCityWeatherData = async (
  cityId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<boolean> => {
  const city = await db.query.cities.findFirst({
    where: eq(cities.id, cityId)
  });
  if (!city) {
    log.warn({ cityId }, 'City not found');
    return false;
  }

  if (!options.forceRefresh) {
    const cached = await readCachedWeatherData(cityId);
    if (cached && isFresh(cached.fetchedAt)) {
      await db
        .update(cities)
        .set({
          avgSunshineHours: cached.sunshineHours ?? city.avgSunshineHours,
          avgTempHigh: cached.avgTempHigh ?? city.avgTempHigh,
          avgTempLow: cached.avgTempLow ?? city.avgTempLow,
          dataLastUpdated: new Date(cached.fetchedAt)
        })
        .where(eq(cities.id, cityId));
      return true;
    }
  }

  const station = await findNearestStation(city.latitude, city.longitude);
  if (!station) {
    log.warn({ cityId, cityName: city.name }, 'No weather station found');
    return false;
  }

  const [sunshineHours, temps] = await Promise.all([
    fetchSunshineHours(station.id),
    fetchTemperatureNormals(station.id)
  ]);

  const cacheData: WeatherDataCache = {
    cityId: city.id,
    cityName: city.name,
    station,
    sunshineHours,
    avgTempHigh: temps.avgTempHigh,
    avgTempLow: temps.avgTempLow,
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
  await writeCachedWeatherData(cacheData);

  await db
    .update(cities)
    .set({
      avgSunshineHours: sunshineHours ?? city.avgSunshineHours,
      avgTempHigh: temps.avgTempHigh ?? city.avgTempHigh,
      avgTempLow: temps.avgTempLow ?? city.avgTempLow,
      dataLastUpdated: new Date()
    })
    .where(eq(cities.id, cityId));

  return true;
};

// Batch refresh, rate limited to 5 req/sec per NOAA's limit. Run via
// `bun scripts/update-noaa-cache.ts`, not on the request path.
export const updateAllCitiesWeatherData = async (): Promise<void> => {
  const allCities = await db.query.cities.findMany();
  for (const city of allCities) {
    await updateCityWeatherData(city.id);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
};
