# Result Type

Warpkit uses `@bitclaw/result` for typed error handling in all server functions. Every server function returns a `Result<T>` instead of throwing.

## Why

Throwing errors across the server/client boundary in TanStack Start loses type information: the client receives an opaque error with no structured data. `Result<T>` makes success and failure explicit in the return type, so the client can handle both without try/catch.

## Shape

```ts
type Result<T> =
  | { ok: true;  data: T }
  | { ok: false; code: string; message: string }
```

## Server: returning results

```ts
import { err, ok } from '@bitclaw/result';
import { ERROR_CODES } from '@/lib/constants';

export const createItem = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ title: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!user) return err(ERROR_CODES.UNAUTHORIZED, 'Not authenticated');

    // happy path
    return ok({ id: 'new-id', title: data.title });
  });
```

`err(code, message)`: returns `{ ok: false, code, message }`

`ok(data)`: returns `{ ok: true, data }`

## Client: consuming results

```ts
const result = await createItem({ data: { title: 'My item' } });

if (!result.ok) {
  console.error(result.code, result.message);
  return;
}

// result.data is typed as { id: string; title: string }
console.log(result.data.id);
```

In a route loader:

```tsx
export const Route = createFileRoute('/_app/items')({
  loader: () => getItems(),
  component: ItemsPage,
});

function ItemsPage() {
  const result = Route.useLoaderData();

  if (!result.ok) return <ErrorBanner message={result.message} />;

  return <ul>{result.data.map(item => <li key={item.id}>{item.title}</li>)}</ul>;
}
```

## Error codes

All codes are defined in `src/lib/constants/errors.ts`:

```
UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), VALIDATION_ERROR (422),
RATE_LIMITED (429), STRIPE_ERROR (500), NO_SUBSCRIPTION, EMAIL_PROVIDER_NOT_CONFIGURED,
EMAIL_SEND_FAILED, INTERNAL (500), ACCOUNT_DELETION_PENDING, PLAN_LIMIT_EXCEEDED,
STORAGE_NOT_CONFIGURED, NO_CREDITS, EMAIL_DISPOSABLE, EMAIL_DOMAIN_INVALID,
CANCEL_FAILED, RETRY_FAILED
```

Always use `ERROR_CODES.*`: never hardcode string literals: so errors are refactorable and greppable.

## Server routes

TanStack Start server routes (`createFileRoute` + `server.handlers`) return standard `Response` objects. They don't use `Result` because they go over the wire as raw JSON, not through TanStack's server function layer.

```ts
// Server route: return Response with status code
return Response.json({ error: 'Too many requests' }, { status: 429 });

// Server function: use ok()/err()
return err(ERROR_CODES.RATE_LIMITED, 'Too many requests');
```
