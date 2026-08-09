import { useEffect, useState } from 'react';
import { config } from '@/config';

type Theme = 'light' | 'dark' | 'system';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const VALID_THEMES: ReadonlySet<string> = new Set<Theme>([
  'light',
  'dark',
  'system'
]);

// Must match config.theme.defaultMode, and by extension __root.tsx's SSR
// inline script - all three have to agree on what an unset preference
// resolves to, or SSR renders one mode and hydration flips to the other
// (a flash).
const getStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return config.theme.defaultMode;
  const stored = localStorage.getItem('theme');
  return stored && VALID_THEMES.has(stored)
    ? (stored as Theme)
    : config.theme.defaultMode;
};

const applyTheme = (theme: Theme) => {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
};

const NEXT_THEME: Record<Theme, 'light' | 'dark'> = {
  dark: 'light',
  light: 'dark',
  system: 'light'
};

export function useTheme() {
  const [mounted, setMounted] = useState(false);
  const [theme, setThemeState] = useState<Theme>(config.theme.defaultMode);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    setTheme(NEXT_THEME[theme]);
  };

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);

    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, mounted]);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? getSystemTheme() : theme;

  return { theme, resolvedTheme, setTheme, toggleTheme, mounted };
}
