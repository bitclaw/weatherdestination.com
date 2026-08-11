import { useEffect } from 'react';
import { toast } from '@/components/ui/toast';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const POLL_JITTER_MS = 30 * 1000; // +/- 30s around the interval

// Re-randomized on every reschedule, not just once at mount - avoids every
// open tab's poll staying roughly phase-aligned after a synchronized
// mass-mount event (a marketing email, everyone reloading post-incident),
// which would otherwise produce a periodic burst against /api/version every
// interval thereafter. Exported for the bounds test.
export function withJitter(ms: number): number {
  return ms + (Math.random() * 2 - 1) * POLL_JITTER_MS;
}

// Proactively detects a new deploy while the tab is open, rather than
// reacting to a chunk 404 after the fact (see chunk-reload-guard.ts for the
// reactive counterpart, which can't self-heal if the entry chunk itself
// fails to load). Does not auto-reload - unlike the reactive guard, this is
// a live, working page; reloading out from under the user would drop
// in-progress form state.
//
// Simpler than a runtime-env-var-per-deploy design: VITE_BUILD_ID is a
// build-time constant (see vite.config.ts), identical everywhere the same
// build's code runs, so the client can compare its own baked-in value
// directly against the poll response with no server round-trip needed for
// the initial value.
export function useUpdateAvailable(): void {
  useEffect(() => {
    const currentBuildId = import.meta.env.VITE_BUILD_ID ?? 'dev';
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const res = await fetch('/api/version');
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (buildId && buildId !== currentBuildId) {
          // Warms the HTTP cache for the reload target ahead of the click.
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = location.href;
          document.head.appendChild(link);
          toast.info('Update available', {
            description: 'Reload to get the latest version.',
            duration: Number.POSITIVE_INFINITY,
            action: {
              label: 'Reload',
              onClick: () => window.location.reload()
            }
          });
          // No further poll can teach this tab anything useful - reloading
          // gets the latest build regardless of what a later poll would
          // find. Deliberately does not reschedule.
          return;
        }
      } catch {
        // Transient network error - try again next tick, not worth surfacing.
      }
      timeoutId = setTimeout(tick, withJitter(POLL_INTERVAL_MS));
    };

    timeoutId = setTimeout(tick, withJitter(POLL_INTERVAL_MS));
    return () => clearTimeout(timeoutId);
  }, []);
}
