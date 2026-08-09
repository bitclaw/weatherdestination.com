# Schema Validation

All server function inputs are validated with [Zod](https://zod.dev) via TanStack Start's `inputValidator`.

## How it works

```ts
import { z } from 'zod';
import { createServerFn } from '@tanstack/react-start';

export const createItem = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      title: z.string().min(1).max(200),
    })
  )
  .handler(async ({ data }) => {
    // data.title is guaranteed to be a string of 1–200 chars
  });
```

`inputValidator` runs before the handler. Invalid input returns a 400 error automatically: no manual checking needed.

## Server route validation

TanStack Start server routes (`createFileRoute` + `server.handlers`) validate with Zod manually:

```ts
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

const body = await request.json();
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return Response.json({ error: 'Invalid email' }, { status: 400 });
}
// parsed.data.email is safe
```

## Conventions

- Validate at system boundaries only (user input, webhooks, external APIs)
- Trust internal function calls: don't validate data that comes from your own DB
- Use `.min()` / `.max()` on strings to prevent oversized payloads
- Use `.email()` for email fields: Zod validates format, not deliverability
