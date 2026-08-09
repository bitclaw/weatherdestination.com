# Lead Form

Email capture form for pre-launch waitlists. Submits to `POST /api/v1/lead`.

Not rendered by default , a ready-to-use instance is commented out in
`src/components/landing/landing-hero.tsx`, meant to **swap the default CTA**, not sit
alongside it (the default hero assumes the product has already launched). Uncomment it
there rather than importing it fresh.

## Usage

```tsx
import { LeadForm } from '@/components/landing';

<LeadForm />
```

Handles submission, loading state, and success/error feedback. No props required.

## What it does

1. User enters email and submits
2. POST to `/api/v1/lead`
3. On success: shows confirmation message
4. On error: shows error message

## Prerequisite

The leads feature must be enabled (default). If `FEATURE_LEADS=false`, the endpoint returns 404.

## File

`src/components/landing/lead-form.tsx`
