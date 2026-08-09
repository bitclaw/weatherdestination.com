# Query Key Factories

TanStack Query identifies cached data by query key. Two calls with different keys are treated as different data , `invalidateQueries` with a key that doesn't match the original `queryOptions` key silently does nothing.

TypeScript won't catch the mismatch. `invalidateQueries` accepts `unknown[]`, so `['myItems']` and `['my-items']` both type-check even though they refer to different cache entries.

## The pattern

All query keys are factory functions in `src/lib/query-keys.ts`. Import the same factory in both `queryOptions` and `invalidateQueries`.

```ts
// src/lib/query-keys.ts
export const notesQueryKey = () => ['notes'] as const;
export const noteDetailQueryKey = (id: string) => ['notes', id] as const;
```

```ts
// In the feature barrel (index.ts):
import { queryOptions } from '@tanstack/react-query';
import { notesQueryKey } from '@/lib/query-keys';
import { getNotesFn } from './server/notes.queries';

export const notesQueryOptions = queryOptions({
  queryKey: notesQueryKey(),
  queryFn: async () => {
    const result = await getNotesFn();
    if (!result.ok) throw new Error(result.message);
    return result.data;
  },
  staleTime: 30_000
});
```

```ts
// In a mutation (after write, invalidate via factory):
import { notesQueryKey } from '@/lib/query-keys';

await queryClient.invalidateQueries({ queryKey: notesQueryKey() });
```

A factory import error is a compile error. An inline string mismatch is invisible.

## Where queryOptions live

`queryOptions` objects belong in the **feature barrel** (`features/*/index.ts`), not inline in route files. Route files import and use them:

```ts
// Route file:
import { notesQueryOptions } from '@/features/notes';

export const Route = createFileRoute('/_app/dashboard/notes/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(notesQueryOptions),
  component: NotesPage
});
```

This makes `queryOptions` reusable across routes and keeps route files thin.

## Testability

`src/lib/query-keys.ts` imports nothing from the server layer. It's safe to import in `bun:test` without triggering server function registration side effects:

```ts
import { notesQueryKey } from '@/lib/query-keys';
// No server fn imports → no side effects in test env
```

## Adding a new query key

Add to `src/lib/query-keys.ts`:

```ts
export const myFeatureQueryKey = () => ['my-feature'] as const;
export const myFeatureDetailQueryKey = (id: string) => ['my-feature', id] as const;
```

Then use the factory everywhere , `queryOptions`, `invalidateQueries`, `prefetchQuery`. Never write the key as an inline array.
