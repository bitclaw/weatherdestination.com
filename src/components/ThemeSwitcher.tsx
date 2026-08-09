import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

type Theme = 'system' | 'light' | 'dark';

const options: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' }
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <fieldset className="border-input bg-muted/50 inline-flex items-center gap-0.5 rounded-lg border p-0.5">
      <legend className="sr-only">Select a display theme:</legend>
      {options.map(opt => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <label
            className={cn(
              'flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            key={opt.value}
          >
            <input
              aria-label={opt.label}
              checked={active}
              className="sr-only"
              name="theme"
              onChange={() => setTheme(opt.value)}
              type="radio"
              value={opt.value}
            />
            <Icon className="h-3.5 w-3.5" />
          </label>
        );
      })}
    </fieldset>
  );
}
