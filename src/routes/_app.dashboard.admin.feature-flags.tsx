import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { FeatureFlagRecord } from '@/features/feature-flags';
import {
  deleteFeatureFlagFn,
  featureFlagsQueryOptions,
  setFeatureFlagFn
} from '@/features/feature-flags';
import { featureFlagsQueryKey } from '@/lib/query-keys';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/admin/feature-flags')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    await ctx.queryClient.prefetchQuery(featureFlagsQueryOptions);
  },
  component: FeatureFlagsPage
});

function FeatureFlagsPage() {
  const queryClient = useQueryClient();
  const { data: flags } = useSuspenseQuery(featureFlagsQueryOptions);
  const [newFlag, setNewFlag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [addPending, setAddPending] = useState(false);

  type CacheData = typeof flags;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: featureFlagsQueryKey() });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const flag = newFlag.trim();
    if (!flag) return;

    if (!/^[a-z][a-z0-9_]*$/.test(flag)) {
      setError(
        'Flag name must start with a letter and contain only lowercase letters, numbers, and underscores.'
      );
      return;
    }

    setError(null);
    setAddPending(true);

    const prev = queryClient.getQueryData<CacheData>(featureFlagsQueryKey());
    queryClient.setQueryData<CacheData>(featureFlagsQueryKey(), old => {
      if (!old) return old;
      return [
        ...old,
        {
          id: `optimistic-${flag}`,
          flag,
          enabled: false,
          createdAt: new Date(),
          updatedAt: null
        }
      ];
    });

    try {
      const res = await setFeatureFlagFn({ data: { flag, enabled: false } });
      if (!res.ok) {
        setError(res.message);
        queryClient.setQueryData(featureFlagsQueryKey(), prev);
        return;
      }
      setNewFlag('');
      await refresh();
    } catch (err: unknown) {
      queryClient.setQueryData(featureFlagsQueryKey(), prev);
      setError(err instanceof Error ? err.message : 'Failed to add flag');
    } finally {
      setAddPending(false);
    }
  };

  const handleToggle = async (flag: string, enabled: boolean) => {
    setError(null);
    setPending(flag);

    const prev = queryClient.getQueryData<CacheData>(featureFlagsQueryKey());
    queryClient.setQueryData<CacheData>(featureFlagsQueryKey(), old => {
      if (!old) return old;
      return old.map((f: FeatureFlagRecord) =>
        f.flag === flag ? { ...f, enabled } : f
      );
    });

    try {
      const res = await setFeatureFlagFn({ data: { flag, enabled } });
      if (!res.ok) {
        setError(res.message);
        queryClient.setQueryData(featureFlagsQueryKey(), prev);
        return;
      }
      await refresh();
    } catch (e: unknown) {
      queryClient.setQueryData(featureFlagsQueryKey(), prev);
      setError(e instanceof Error ? e.message : 'Failed to update flag');
    } finally {
      setPending(null);
    }
  };

  const handleDelete = async (flag: string) => {
    setError(null);
    setPending(flag);

    const prev = queryClient.getQueryData<CacheData>(featureFlagsQueryKey());
    queryClient.setQueryData<CacheData>(featureFlagsQueryKey(), old => {
      if (!old) return old;
      return old.filter((f: FeatureFlagRecord) => f.flag !== flag);
    });

    try {
      const res = await deleteFeatureFlagFn({ data: { flag } });
      if (!res.ok) {
        setError(res.message);
        queryClient.setQueryData(featureFlagsQueryKey(), prev);
        return;
      }
      await refresh();
    } catch (e: unknown) {
      queryClient.setQueryData(featureFlagsQueryKey(), prev);
      setError(e instanceof Error ? e.message : 'Failed to delete flag');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Feature Flags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggle features on or off across the entire app. Use{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            useFeatureFlag('flag_name')
          </code>{' '}
          in any component to check a flag.
        </p>
      </div>

      <form className="flex gap-2" onSubmit={handleAdd}>
        <Input
          className="max-w-xs font-mono text-sm"
          disabled={addPending}
          onChange={e => setNewFlag(e.target.value)}
          placeholder="new_feature_name"
          value={newFlag}
        />
        <Button disabled={!newFlag.trim() || addPending} type="submit">
          Add Flag
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {flags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No feature flags yet. Add one above.
        </p>
      ) : (
        <div className="space-y-2">
          {flags.map(f => (
            <div
              className="flex items-center justify-between rounded-lg border px-4 py-3"
              key={f.flag}
            >
              <div className="flex items-center gap-3">
                <Switch
                  checked={f.enabled}
                  disabled={pending === f.flag}
                  onCheckedChange={enabled => handleToggle(f.flag, enabled)}
                />
                <code className="text-sm">{f.flag}</code>
              </div>
              <Button
                aria-label={`Delete ${f.flag}`}
                disabled={pending === f.flag}
                onClick={() => handleDelete(f.flag)}
                size="icon"
                variant="ghost"
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
