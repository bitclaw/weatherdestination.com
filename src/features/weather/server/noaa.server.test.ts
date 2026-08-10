import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  fetchSunshineHours,
  fetchTemperatureNormals,
  findNearestStation
} from './noaa.server';

// Round-2 audit: zero test coverage. updateCityWeatherData/
// updateAllCitiesWeatherData are out of scope here - they import the real
// shared `db` singleton at module scope with no injectable seam (writes to
// the real data/meta.db, not an in-memory test db), unlike every other
// tested server module in this repo which goes through makeTestSharedDb().
// Scoped to the 3 exported NOAA-calling functions, which only need
// globalThis.fetch stubbed - station lookup, unit conversion math, and the
// try/catch-to-null error handling on each.

const originalFetch = globalThis.fetch;
const originalToken = process.env.NOAA_API_TOKEN;

beforeEach(() => {
  process.env.NOAA_API_TOKEN = 'test-token';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken !== undefined) {
    process.env.NOAA_API_TOKEN = originalToken;
  } else {
    delete process.env.NOAA_API_TOKEN;
  }
});

function stubFetchJson(body: unknown, ok = true, status = 200) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      statusText: ok ? 'OK' : 'Error'
    })) as unknown as typeof fetch;
}

describe('findNearestStation', () => {
  it('returns the first station from a successful lookup', async () => {
    stubFetchJson({
      results: [
        {
          id: 'GHCND:USW00094728',
          name: 'NY CITY CENTRAL PARK',
          latitude: 40.78,
          longitude: -73.97,
          elevation: 42.7
        }
      ]
    });

    const station = await findNearestStation(40.78, -73.97);
    expect(station?.id).toBe('GHCND:USW00094728');
    expect(station?.name).toBe('NY CITY CENTRAL PARK');
  });

  it('returns null when the results array is empty', async () => {
    stubFetchJson({ results: [] });
    expect(await findNearestStation(0, 0)).toBeNull();
  });

  it('returns null (not throw) when the NOAA API responds with an error status', async () => {
    globalThis.fetch = (async () =>
      new Response('rate limited', {
        status: 429,
        statusText: 'Too Many Requests'
      })) as unknown as typeof fetch;

    expect(await findNearestStation(0, 0)).toBeNull();
  });

  it('returns null (not throw) when NOAA_API_TOKEN is not configured', async () => {
    delete process.env.NOAA_API_TOKEN;
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response('{}');
    }) as unknown as typeof fetch;

    expect(await findNearestStation(0, 0)).toBeNull();
    expect(fetchCalled).toBe(false);
  });

  it('queries NOAA with a bounding box centered on the given coordinates', async () => {
    let requestedUrl = '';
    globalThis.fetch = (async (url: string) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ results: [] }));
    }) as unknown as typeof fetch;

    await findNearestStation(40, -100);

    const parsed = new URL(requestedUrl);
    expect(parsed.searchParams.get('extent')).toBe('39.5,-100.5,40.5,-99.5');
  });
});

describe('fetchSunshineHours', () => {
  it('averages the datapoint values', async () => {
    stubFetchJson({
      results: [{ value: 10 }, { value: 20 }, { value: 30 }]
    });
    expect(await fetchSunshineHours('GHCND:TEST')).toBe(20);
  });

  it('returns null when there are no datapoints', async () => {
    stubFetchJson({ results: [] });
    expect(await fetchSunshineHours('GHCND:TEST')).toBeNull();
  });

  it('returns null (not throw) on a NOAA API error', async () => {
    globalThis.fetch = (async () =>
      new Response('error', { status: 500 })) as unknown as typeof fetch;
    expect(await fetchSunshineHours('GHCND:TEST')).toBeNull();
  });
});

describe('fetchTemperatureNormals', () => {
  it('converts NOAA tenths-of-a-degree-Celsius averages to Fahrenheit', async () => {
    // 250 = 25.0degC -> (25 * 9/5) + 32 = 77degF
    // 100 = 10.0degC -> (10 * 9/5) + 32 = 50degF
    let call = 0;
    globalThis.fetch = (async () => {
      call++;
      const value = call === 1 ? 250 : 100; // TMAX then TMIN, per Promise.all order
      return new Response(JSON.stringify({ results: [{ value }] }));
    }) as unknown as typeof fetch;

    const result = await fetchTemperatureNormals('GHCND:TEST');
    expect(result.avgTempHigh).toBeCloseTo(77, 5);
    expect(result.avgTempLow).toBeCloseTo(50, 5);
  });

  it('returns null for both fields when there are no datapoints', async () => {
    stubFetchJson({ results: [] });
    const result = await fetchTemperatureNormals('GHCND:TEST');
    expect(result.avgTempHigh).toBeNull();
    expect(result.avgTempLow).toBeNull();
  });

  it('returns null for both fields (not throw) on a NOAA API error', async () => {
    globalThis.fetch = (async () =>
      new Response('error', { status: 500 })) as unknown as typeof fetch;
    const result = await fetchTemperatureNormals('GHCND:TEST');
    expect(result.avgTempHigh).toBeNull();
    expect(result.avgTempLow).toBeNull();
  });
});
