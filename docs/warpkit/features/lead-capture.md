# Lead Capture

Collect emails before your product launches. Warpkit includes a `/api/v1/lead` endpoint and a `<LeadForm>` component ready to drop into your landing page.

## How it works

1. Visitor submits their email via `<LeadForm>`
2. Email is stored in the shared DB (`leads` table)
3. A confirmation email is sent to the visitor

## The endpoint

`POST /api/v1/lead`

```json
{ "email": "visitor@example.com", "turnstileToken": null }
```

`turnstileToken` is optional and nullable (accepts `null` or a real token string, not just
undefined , the frontend's `NoCaptchaProvider` sends `null` when Turnstile is disabled,
the out-of-the-box default). Only verified server-side when `TURNSTILE_SECRET_KEY` is set.

Responses:

| Status | Body |
|--------|------|
| 200 | `{ "ok": true }` |
| 400 | `{ "error": "Invalid email" }` |
| 404 | `{ "error": "Not found" }` (feature disabled) |
| 429 | `{ "error": "Too many requests" }` |

Rate limited to 20 requests per IP per minute in production.

## Using the lead form component

A ready-to-use, pre-wired swap is already sitting **commented out** in
`src/components/landing/landing-hero.tsx`, right below the default CTA button , uncomment
it there instead of hand-rolling the import yourself. It's a swap, not an addition: the
default hero assumes the product has already launched (shows real signup/login CTAs);
`<LeadForm>` replaces that CTA for a pre-launch waitlist page instead.

```tsx
import { LeadForm } from '@/components/landing';

<LeadForm />
```

The form handles submission, loading state, and success/error feedback. No additional setup needed.

## Enable / disable

The leads feature is on by default. Disable it:

```bash
FEATURE_LEADS=false
```

When disabled, the endpoint returns 404.

## Viewing leads

Leads are in the `leads` table of the shared database. Query with Drizzle or any SQLite browser:

```ts
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';

const all = await db.select().from(leads).orderBy(leads.createdAt);
```

## Confirmation email

The `LeadConfirmationEmail` template is sent on every successful submission. Edit it in `src/server/email-templates.tsx`. Preview it at `/dev/emails`.
