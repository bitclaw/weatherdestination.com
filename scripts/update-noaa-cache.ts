import { updateAllCitiesWeatherData } from '@/features/weather/server/noaa.server';

await updateAllCitiesWeatherData();
console.info('NOAA cache refresh complete.');
