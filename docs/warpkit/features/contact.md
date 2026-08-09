# Contact Form

Lets visitors reach the team without exposing a raw email address anywhere in the HTML. Warpkit
includes a `/api/v1/contact` endpoint, a `<ContactForm>` component, and a `/contact` page,
all wired together out of the box.

Replaces the pattern of rendering `mailto:` links / plain email text in the footer, error
pages, and legal pages , those get scraped, spam-harvested, and (if your host obfuscates
email addresses at the edge, e.g. Cloudflare's Email Address Obfuscation) reported as
broken links by SEO crawlers that don't execute the obfuscation-decoding JS.

## How it works

1. Visitor fills out name, email, and message on `/contact` (`<ContactForm>`)
2. Request is validated, rate-limited, and optionally captcha-checked
3. A notification email is sent to `config.legal.companyEmail` via `sendEmail()`

No database table backs this feature , unlike lead capture, there is nothing to browse or
query later. A failed send returns a hard error to the visitor instead of silently
succeeding, since there's no persisted row to fall back on.

## The endpoint

`POST /api/v1/contact`

```json
{
  "name": "Visitor Name",
  "email": "visitor@example.com",
  "message": "Question or feedback text, 10-5000 characters.",
  "turnstileToken": null
}
```

`turnstileToken` is optional and nullable (accepts `null` or a real token string, not just
undefined , the frontend's `NoCaptchaProvider` sends `null` when Turnstile is disabled,
the out-of-the-box default). Only verified server-side when `TURNSTILE_SECRET_KEY` is set.

Responses:

| Status | Body |
|--------|------|
| 200 | `{ "ok": true }` |
| 400 | `{ "error": "Invalid request" }` |
| 403 | `{ "error": "Captcha verification failed" }` |
| 429 | `{ "error": "Too many requests" }` |
| 500 | `{ "error": "Failed to send message" }` |

Rate limited to 20 requests per IP per minute in production.

## No feature flag

Unlike `leads` (a pre-launch waitlist feature many live sites won't want), the contact form
has no `FEATURE_CONTACT` toggle , being reachable is a baseline expectation for a live
site, so it's always on.

## Using the contact form component

```tsx
import { ContactForm } from '@/components/landing';

<ContactForm />
```

Already used on the `/contact` page (`src/routes/_landing.contact.tsx`). The form handles
submission, loading state, and success/error feedback.

## Notification email

The `ContactNotificationEmail` template is sent to `config.legal.companyEmail` on every
successful submission. Edit it in `src/server/email-templates.tsx`. Preview it at
`/dev/emails/contact-notification`.
