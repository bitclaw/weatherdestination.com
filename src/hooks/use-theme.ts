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

// Must match styles.css's :root/.dark --background and --foreground, and
// stay in sync with __root.tsx's SSR init script, which paints these same
// values as inline styles on <html> to win the pre-stylesheet paint race.
// That inline style outlives hydration - it's never removed - so if this
// function only toggled the `dark` class, the inline color/background from
// the initial page load would keep overriding the new theme's CSS variables
// (inline style beats any class-based rule) until the next full reload.
const THEME_PAINT: Record<
  'light' | 'dark',
  { background: string; foreground: string }
> = {
  light: {
    background: 'oklch(98% 0.005 230)',
    foreground: 'oklch(14% 0.04 230)'
  },
  dark: {
    background: 'oklch(14% 0.025 230)',
    foreground: 'oklch(93% 0.01 230)'
  }
};

const applyTheme = (theme: Theme) => {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  const html = document.documentElement;
  html.classList.toggle('dark', resolved === 'dark');
  html.style.colorScheme = resolved;
  html.style.backgroundColor = THEME_PAINT[resolved].background;
  html.style.color = THEME_PAINT[resolved].foreground;
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
