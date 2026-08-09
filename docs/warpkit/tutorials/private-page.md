# Private Page

Create a page only authenticated users can access.

## Step 1: Create the route file

Add a file under `src/routes/` prefixed with `_app.`:

```
src/routes/_app.notes.tsx
```

The `_app` prefix means TanStack Router places this route inside the `_app.tsx` layout, which handles the auth redirect automatically.

## Step 2: Write the route

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { getNotes } from '@/features/notes';

export const Route = createFileRoute('/_app/notes')({
  component: NotesPage,
  loader: () => getNotes(),
});

function NotesPage() {
  const notes = Route.useLoaderData();

  return (
    <div>
      <h1>My Notes</h1>
      {notes.data?.map(note => (
        <p key={note.id}>{note.content}</p>
      ))}
    </div>
  );
}
```

## Step 3: Regenerate the route tree

```bash
bun run generate
```

This updates `src/routeTree.gen.ts` to include your new route. Run this any time you add, rename, or remove a route file.

## How the auth guard works

`src/routes/_app.tsx` runs `beforeLoad` to check the session. If no session, it redirects to `/login`. You never need to add auth checks in individual route files.
