import stylesRaw from '@/styles.css?raw';
import { extractCssVar, oklchToHex } from './email-theme';

const resolve = (varName: string, fallback: string) => {
  const val = extractCssVar(stylesRaw, varName);
  return val ? oklchToHex(val) : fallback;
};

export const emailTheme = {
  primaryColor: resolve('--primary', '#111827'),
  primaryForeground: resolve('--primary-foreground', '#ffffff'),
  background: resolve('--background', '#f9fafb'),
  foreground: resolve('--foreground', '#111827'),
  muted: resolve('--muted', '#f3f4f6'),
  mutedForeground: resolve('--muted-foreground', '#6b7280'),
  border: resolve('--border', '#e5e7eb'),
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
};
