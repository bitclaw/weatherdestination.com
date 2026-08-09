# Email

Warpkit sends email with [React Email](https://react.email) components. Two providers are configured out of the box: **Resend** (default) and **Nodemailer** (SMTP).

## Configuration

Set `EMAIL_PROVIDER` to select the provider (defaults to `resend`):

```bash
EMAIL_PROVIDER=resend   # default
EMAIL_PROVIDER=smtp
```

### Resend

```bash
RESEND_API_KEY=re_...
```

### SMTP / Nodemailer

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
```

Sender name and address come from `config.ts`:

```ts
resend: {
  fromEmail: 'noreply@myapp.com',
  fromName: 'MyApp',
},
```

## Sending email

```ts
import { sendEmail } from '@/server/email';
import { WelcomeEmail } from '@/server/email-templates';

await sendEmail({
  to: user.email,
  subject: `Welcome to ${config.appName}!`,
  react: WelcomeEmail({ name: user.name, appName: config.appName }),
});
```

You can also pass raw HTML instead of a React component:

```ts
await sendEmail({
  to: user.email,
  subject: 'Hello',
  html: '<p>Hello world</p>',
});
```

## Built-in templates

All templates live in `src/server/email-templates.tsx`.

| Template | Sent when |
|----------|-----------|
| `OtpEmail` | OTP login code |
| `MagicLinkEmail` | Magic link login |
| `WelcomeEmail` | User signs up for the first time |
| `LeadConfirmationEmail` | Email submitted to waitlist |
| `ReceiptEmail` | One-time or credits purchase completes (queued via `handleReceiptEmail` job) |
| `OnboardingDay3Email` | 3 days after signup (queued job) |
| `OnboardingDay7Email` | 7 days after signup (queued job) |
| `TrialExpiringEmail` | Trial subscription is about to end (queued job) |
| `ReengagementEmail` | Inactive user re-engagement nudge (queued job) |

## Creating a template

```tsx
// src/server/email-templates.tsx
export function InvoiceEmail({ amount, invoiceUrl }: { amount: number; invoiceUrl: string }) {
  return (
    <Layout appName={config.appName} preview={`Invoice for $${amount}`}>
      <E.Heading>Your invoice is ready</E.Heading>
      <E.Text>Amount due: <strong>${amount}</strong></E.Text>
      <E.Button href={invoiceUrl}>View invoice</E.Button>
    </Layout>
  );
}
```

Use `@react-email/components` (`E.*`) for all elements. The `Layout` wrapper handles HTML structure, body styles, and the footer.

## Email preview

Visit `/dev/emails` in development to render all templates in the browser. No emails sent, no API credits used. The route is disabled in production.

## Adding a different provider

Warpkit uses the `resend` npm package and `nodemailer` directly. To add Mailgun, Postmark, SendGrid, AWS SES, or others, follow the [React Email integrations guide](https://react.email/docs/integrations/overview).

The pattern is the same for all providers:

1. Install the provider's SDK
2. Add a new branch in `src/server/email.ts` for `EMAIL_PROVIDER=<name>`
3. Call `render(params.react)` from `@react-email/render` to get the HTML string
4. Pass it to the provider's send function

Example adding Postmark:

```ts
import { ServerClient } from 'postmark';

if (provider === 'postmark') {
  const client = new ServerClient(process.env.POSTMARK_API_TOKEN ?? '');
  const html = await render(params.react);
  const result = await client.sendEmail({
    From: `${config.resend.fromName} <${config.resend.fromEmail}>`,
    To: Array.isArray(params.to) ? params.to.join(',') : params.to,
    Subject: params.subject,
    HtmlBody: html,
  });
  return ok({ id: result.MessageID });
}
```
