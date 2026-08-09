# Send an Email

Warpkit uses React Email components and sends via Resend (or any SMTP server).

## Setup

```bash
RESEND_API_KEY=re_...
```

Or for SMTP:

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

## Send a transactional email

```ts
import { sendEmail } from '@/server/email';
import { MyEmail } from '@/server/email-templates';

await sendEmail({
  to: user.email,
  subject: 'Your report is ready',
  react: MyEmail({ name: user.name }),
});
```

## Create an email template

Add a component to `src/server/email-templates.tsx`:

```tsx
export function MyEmail({ name }: { name: string }) {
  return (
    <Layout appName={config.appName} preview="Your report is ready">
      <E.Heading>Hi {name}</E.Heading>
      <E.Text>Your report is ready to download.</E.Text>
      <E.Button href="https://myapp.com/dashboard">View report</E.Button>
    </Layout>
  );
}
```

## Preview emails in dev

Visit `/dev/emails` while running `bun run dev`. All templates render in the browser: no emails sent, no Resend credits used.

## Built-in email templates

| Template | When sent |
|----------|-----------|
| `OtpEmail` | Login OTP code |
| `MagicLinkEmail` | Magic link login |
| `WelcomeEmail` | On user signup |
| `LeadConfirmationEmail` | Waitlist confirmation |
