# Import Protection

Warpkit's build blocks certain file paths from appearing in the client bundle. Importing a protected path from a route component or client hook causes a build error , but the error message is often confusing (`cannot find module`, empty chunk, broken hydration) rather than pointing directly at the import.

## What Vite blocks

Two path patterns are blocked from client bundles via `vite.config.ts`:

| Pattern | What it covers |
|---------|---------------|
| `**/*.server.*` | Any file with `.server.` in the name |
| `**/lib/db/**` | All DB utilities under `src/lib/db/` |

`src/server/**` is server-only by convention (not Vite-blocked), but TanStack Start's SSR split means importing from there in route components or client hooks breaks hydration. Treat it as blocked.

## Error symptoms

If you accidentally import a protected path from client code:

- `"cannot find module"` at build time
- An empty or near-empty JS chunk in the output
- Hydration mismatch errors at runtime
- A route that renders nothing with no obvious error

These errors don't mention the import protection rule , they look like missing dependencies.

## Adding a server-only utility

When you create a new utility that must never reach the client:

**Option A , name it `*.server.ts`:**
```
src/features/my-feature/server/my-feature.server.ts  ✓
src/features/my-feature/server/my-feature-utils.server.ts  ✓
```

**Option B , place it under `src/lib/db/` or `src/server/`:**
```
src/lib/db/my-helper.ts  ✓
src/server/my-helper.ts  ✓
```

Then import it directly from mutations or queries , **not** through the feature barrel:

```ts
// CORRECT , direct import bypasses the barrel (import protection)
import { myHelper } from '@/features/my-feature/server/my-feature.server';

// WRONG , barrel re-exports the helper into the client bundle
import { myHelper } from '@/features/my-feature';
```

The barrel (`index.ts`) is client-safe code. Anything exported from it can appear in the browser. Server-only utilities must be imported directly.

## `createServerFn` does NOT protect top-level imports

This is the single most common mistake in this codebase , it has recurred 5+ times across
audits (uploads, credits, email-validation, account-deletion, two API routes, the jobs
queue/scheduler).

TanStack Start replaces a `createServerFn().handler(...)` body with an RPC stub for the
client bundle, but **static top-level imports in the same file survive that
transformation**. If a `*.mutations.ts`/`*.queries.ts` file has a top-level import of a
Node.js-only package, that package still ships to the browser , even though the handler
body that actually uses it never runs there.

```ts
// WRONG , top-level import leaks into the client bundle even inside createServerFn
import { stripe } from '@/lib/http-clients'; // transitively imports node:crypto

export const myFn = createServerFn().handler(async () => {
  return stripe.checkout.sessions.create({ ... });
});

// RIGHT , dynamic import stays inside the handler body, tree-shaken for the client
export const myFn = createServerFn().handler(async () => {
  const { stripe } = await import('@/lib/http-clients');
  return stripe.checkout.sessions.create({ ... });
});
```

**This includes transitive leaks.** Checking your own file's import statements isn't
enough , if a package you import at the top level itself has a top-level `node:`-builtin
import (check `node_modules/<package>/**` directly), that leaks too. `@bitclaw/jobs`,
`stripe`, and `@bitclaw/disposable-email` have all caused this in this codebase.

The two fixes, same as for any server-only utility: rename the imported module to
`*.server.ts` (if it's a file you own), or move the import inside the handler body as a
dynamic `await import(...)` (works for both first-party and third-party modules, and is
the only fix that also works in `vite dev`, since `rollupOptions.external` is a
production-build-only mitigation).

## Plain server-only functions must bypass the barrel too

A `*.server.ts` file is protected from the client bundle no matter who imports it , but a
**plain function** (not `createServerFn`, not `createServerOnlyFn`) that itself imports a
`.server.ts` module is a different story. If that plain function is re-exported through a
feature's barrel (`index.ts`), and any client route imports *anything* from that barrel,
Vite's import-protection plugin denies the whole build , because the plain function has no
RPC boundary to strip, so its top-level import of the protected module has to actually
resolve, and can't.

```ts
// jobs/enqueue.ts , plain function, not createServerFn
import { getJobQueue } from '@/features/jobs/queue.server';
export const enqueue = (...) => getJobQueue().add(...);

// jobs/index.ts (barrel) , WRONG, even though enqueue.ts itself isn't misnamed
export { enqueue } from './enqueue';

// Any client route importing ANYTHING else from '@/features/jobs' now denies the build:
// [import-protection] Import denied in client environment
//   Importer: src/features/jobs/enqueue.ts
//   Import: "@/features/jobs/queue.server"
```

Fix: don't export plain server-only functions from the barrel at all. Import them directly
from wherever they're actually needed server-side (`import { enqueue } from
'@/features/jobs/enqueue'`), exactly like server-only utilities per the barrel rule above.
Only `createServerFn` results and `queryOptions` factories belong in the barrel.

## Checking your imports

To verify a file won't appear in the client bundle, check that it either:
1. Lives under `src/server/` or `src/lib/db/`
2. Has `.server.` in its filename
3. Is only imported from other files that satisfy (1) or (2)

If unsure, run `bun run build` and check whether your file appears in `dist/client/assets/`.
