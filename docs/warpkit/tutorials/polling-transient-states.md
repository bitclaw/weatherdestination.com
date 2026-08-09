# Polling During Transient States

Some operations take time to complete: server provisioning, file processing, account deletion. While the entity is in a transient state (e.g. `creating`, `processing`), the UI needs to auto-refresh until it reaches a terminal state (`ready`, `failed`).

Two patterns are available depending on scope.

## Page-level polling with router.invalidate()

Refreshes the entire page , both the route loader and all active queries , without needing `refetchInterval` on any specific `queryOptions`.

```tsx
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

function MyPage() {
  const router = useRouter();
  const { data } = Route.useLoaderData();
  const status = data.item.status;

  useEffect(() => {
    if (status !== 'creating') return;
    const interval = setInterval(() => router.invalidate(), 3000);
    return () => clearInterval(interval);
  }, [status, router]);

  // ...
}
```

The `useEffect` guard makes the interval self-cleaning: when `status` changes to `ready` or `failed`, the effect re-runs, the guard is false, and no interval is set.

Use this when multiple queries on the page all need to stay fresh, or when the route loader itself needs to re-run.

## Query-level polling with refetchInterval

More surgical , only one query refetches while items are in-progress:

```ts
import { queryOptions } from '@tanstack/react-query';

export const myQueryOptions = queryOptions({
  queryKey: myQueryKey(),
  queryFn: () => fetchMyData(),
  refetchInterval: query => {
    const data = query.state.data as Array<{ status: string }> | undefined;
    return data?.some(r => r.status === 'running' || r.status === 'pending')
      ? 3000   // poll every 3s while any item is in-progress
      : false; // stop when all items are in a terminal state
  }
});
```

The function receives the current query state so it can inspect the data. Return `false` to stop polling; return a number (ms) to continue.

Use this when only one specific query needs to stay fresh while other queries on the page are stable.

## Choosing between them

| | `router.invalidate()` | `refetchInterval` |
|---|---|---|
| Scope | All queries + route loader | One query |
| Setup | `useEffect` in component | `queryOptions` config |
| Best for | Multi-query pages, loader data | Single isolated query |

Both patterns work with `useSuspenseQuery` , no extra Suspense setup needed.
