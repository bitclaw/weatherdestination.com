import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Clock, Pause, Play } from 'lucide-react';
import { useState } from 'react';
import { ErrorBanner } from '@/components/ui/error-banner';
import {
  pauseScheduleAdmin,
  resumeScheduleAdmin,
  schedulesQueryOptions
} from '@/features/jobs';
import type { AppRouteContext } from '@/lib/types';
import { relativeTime } from '@/lib/utils';

const CRON_DESCRIPTIONS: Record<string, string> = {
  '*/5 * * * *': 'every 5 minutes',
  '*/10 * * * *': 'every 10 minutes',
  '*/30 * * * *': 'every 30 minutes',
  '0 * * * *': 'every hour',
  '0 0 * * *': 'daily at midnight',
  '0 3 * * *': 'daily at 3am',
  '0 9 * * *': 'daily at 9am'
};

const describeCron = (cron: string) => CRON_DESCRIPTIONS[cron] ?? cron;

export const Route = createFileRoute('/_app/dashboard/admin/scheduled-jobs')({
  loader: async ({ context }) => {
    const { queryClient } = context as AppRouteContext;
    await queryClient.prefetchQuery(schedulesQueryOptions);
  },
  component: ScheduledJobsPage
});

function ScheduledJobsPage() {
  const router = useRouter();
  const { data: schedules } = useSuspenseQuery(schedulesQueryOptions);

  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (name: string, currentlyEnabled: boolean) => {
    setToggling(name);
    setError(null);
    try {
      const res = currentlyEnabled
        ? await pauseScheduleAdmin({ data: { name } })
        : await resumeScheduleAdmin({ data: { name } });
      if (!res.ok) setError(res.message ?? 'Toggle failed');
      router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Scheduled Jobs</h1>
        <p className="text-muted-foreground">
          Manage cron-scheduled recurring tasks
        </p>
      </div>

      <ErrorBanner className="mb-4" message={error} />

      {schedules.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <Clock className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            No schedules registered.
          </p>
        </div>
      ) : (
        <div className="max-w-2xl divide-y rounded-lg border">
          {schedules.map(schedule => (
            <div className="p-4" key={schedule.name}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{schedule.name}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      schedule.enabled
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}
                  >
                    {schedule.enabled ? 'Enabled' : 'Paused'}
                  </span>
                </div>
                <button
                  className="hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  disabled={toggling !== null}
                  onClick={() => handleToggle(schedule.name, schedule.enabled)}
                  type="button"
                >
                  {schedule.enabled ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      {toggling === schedule.name ? 'Pausing...' : 'Pause'}
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      {toggling === schedule.name ? 'Resuming...' : 'Resume'}
                    </>
                  )}
                </button>
              </div>

              <div className="text-muted-foreground mt-3 space-y-1 text-sm">
                <div>
                  <span className="text-foreground/60">Type:</span>{' '}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">
                    {schedule.type}
                  </code>
                </div>
                <div>
                  <span className="text-foreground/60">Cron:</span>{' '}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">
                    {schedule.cron}
                  </code>
                  {' — '}
                  <span className="text-xs">{describeCron(schedule.cron)}</span>
                </div>
                <div className="flex gap-4">
                  {schedule.lastRunAt && (
                    <span>
                      Last:{' '}
                      {relativeTime(new Date(schedule.lastRunAt).getTime())}
                    </span>
                  )}
                  {schedule.nextRunAt && (
                    <span>
                      Next:{' '}
                      {relativeTime(new Date(schedule.nextRunAt).getTime())}
                    </span>
                  )}
                  {!schedule.lastRunAt && !schedule.nextRunAt && (
                    <span>Not yet run</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
