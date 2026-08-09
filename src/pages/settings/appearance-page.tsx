import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { ContentSection } from './content-section';

type Theme = 'light' | 'dark' | 'system';

const themes: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
];

export function AppearancePage() {
  const { theme, setTheme } = useTheme();

  return (
    <ContentSection
      desc="Customize the appearance of the app. Changes apply immediately."
      title="Appearance"
    >
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">Theme</p>
          <p className="text-xs text-muted-foreground">
            Select the theme for the dashboard.
          </p>
          <RadioGroup
            className="grid max-w-md grid-cols-3 gap-4 pt-2"
            onValueChange={v => setTheme(v as Theme)}
            value={theme}
          >
            {themes.map(t => (
              // biome-ignore lint/a11y/noLabelWithoutControl: RadioGroupItem inside label is a valid association pattern
              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 p-3 transition-colors hover:border-accent',
                  theme === t.value ? 'border-primary' : 'border-muted'
                )}
                key={t.value}
              >
                <RadioGroupItem className="sr-only" value={t.value} />
                <ThemePreview theme={t.value} />
                <span className="text-xs font-normal">{t.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>
    </ContentSection>
  );
}

function ThemePreview({ theme }: { theme: Theme }) {
  if (theme === 'light') {
    return (
      <div className="w-full space-y-1.5 rounded-sm bg-[#ecedef] p-2">
        <div className="space-y-1 rounded-md bg-white p-1.5 shadow-xs">
          <div className="h-1.5 w-12 rounded-lg bg-[#ecedef]" />
          <div className="h-1.5 w-16 rounded-lg bg-[#ecedef]" />
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-white p-1.5 shadow-xs">
          <div className="h-3 w-3 rounded-full bg-[#ecedef]" />
          <div className="h-1.5 w-12 rounded-lg bg-[#ecedef]" />
        </div>
      </div>
    );
  }
  if (theme === 'dark') {
    return (
      <div className="w-full space-y-1.5 rounded-sm bg-slate-950 p-2">
        <div className="space-y-1 rounded-md bg-slate-800 p-1.5 shadow-xs">
          <div className="h-1.5 w-12 rounded-lg bg-slate-400" />
          <div className="h-1.5 w-16 rounded-lg bg-slate-400" />
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-slate-800 p-1.5 shadow-xs">
          <div className="h-3 w-3 rounded-full bg-slate-400" />
          <div className="h-1.5 w-12 rounded-lg bg-slate-400" />
        </div>
      </div>
    );
  }
  return (
    <div className="w-full space-y-1.5 rounded-sm overflow-hidden">
      <div className="flex h-full">
        <div className="w-1/2 space-y-1 bg-[#ecedef] p-2">
          <div className="h-1.5 w-8 rounded-lg bg-white/60" />
          <div className="h-1.5 w-10 rounded-lg bg-white/60" />
        </div>
        <div className="w-1/2 space-y-1 bg-slate-950 p-2">
          <div className="h-1.5 w-8 rounded-lg bg-slate-400" />
          <div className="h-1.5 w-10 rounded-lg bg-slate-400" />
        </div>
      </div>
    </div>
  );
}
