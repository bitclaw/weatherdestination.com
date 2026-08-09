import { config } from '@/config';

export const getAppUrl = (): string =>
  process.env.BETTER_AUTH_URL ?? `https://${config.domainName}`;
