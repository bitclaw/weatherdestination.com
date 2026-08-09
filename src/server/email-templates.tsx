import * as E from '@react-email/components';
import { emailTheme } from '@/lib/email-theme-styles';

type LayoutProps = {
  children: React.ReactNode;
  preview?: string;
  appName: string;
  // CAN-SPAM requires a one-click opt-out on marketing/promotional mail.
  // Only pass this for onboarding/reengagement-style templates - not on
  // OTP/receipt/transactional ones, which don't need it.
  unsubscribeUrl?: string;
};

const Layout = ({
  children,
  preview,
  appName,
  unsubscribeUrl
}: LayoutProps) => (
  <E.Html dir="ltr" lang="en">
    <E.Head />
    {preview && <E.Preview>{preview}</E.Preview>}
    <E.Body style={styles.body}>
      <E.Container style={styles.container}>
        <E.Section style={styles.content}>{children}</E.Section>
        <E.Section style={styles.footer}>
          <E.Text style={styles.footerText}>The {appName} Team</E.Text>
          {unsubscribeUrl && (
            <E.Text style={styles.footerText}>
              <E.Link href={unsubscribeUrl} style={styles.footerLink}>
                Unsubscribe from these emails
              </E.Link>
            </E.Text>
          )}
        </E.Section>
      </E.Container>
    </E.Body>
  </E.Html>
);

export function OtpEmail({ otp, appName }: { otp: string; appName: string }) {
  return (
    <Layout appName={appName} preview={`Your login code: ${otp}`}>
      <E.Heading style={styles.h1}>Your login code</E.Heading>
      <E.Text style={styles.paragraph}>
        Enter this code to sign in to <strong>{appName}</strong>:
      </E.Text>
      <E.Text style={styles.otpCode}>{otp}</E.Text>
      <E.Text style={styles.smallText}>
        Expires in 5 minutes. If you didn't request this, ignore it.
      </E.Text>
    </Layout>
  );
}

export function MagicLinkEmail({
  url,
  appName
}: {
  url: string;
  appName: string;
}) {
  return (
    <Layout appName={appName} preview={`Sign in to ${appName}`}>
      <E.Heading style={styles.h1}>Sign in to {appName}</E.Heading>
      <E.Text style={styles.paragraph}>
        Click the button below to sign in:
      </E.Text>
      <E.Button href={url} style={styles.button}>
        Sign in to {appName}
      </E.Button>
      <E.Text style={styles.smallText}>
        Link expires in 10 minutes. If you didn't request this, ignore it.
      </E.Text>
    </Layout>
  );
}

export function WelcomeEmail({
  name,
  appName,
  dashboardUrl
}: {
  name?: string | null;
  appName: string;
  dashboardUrl: string;
}) {
  return (
    <Layout appName={appName} preview={`Welcome to ${appName}!`}>
      <E.Heading style={styles.h1}>Welcome{name ? `, ${name}` : ''}!</E.Heading>
      <E.Text style={styles.paragraph}>
        Your account is ready. Get started by visiting your dashboard.
      </E.Text>
      <E.Button href={dashboardUrl} style={styles.button}>
        Go to Dashboard
      </E.Button>
    </Layout>
  );
}

export function ReceiptEmail({
  name,
  appName,
  planName,
  amount,
  currency = 'usd',
  periodEnd,
  dashboardUrl
}: {
  name?: string | null;
  appName: string;
  planName: string;
  amount: number;
  currency?: string;
  periodEnd?: Date | null;
  dashboardUrl: string;
}) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount / 100);

  return (
    <Layout appName={appName} preview={`Your ${appName} receipt`}>
      <E.Heading style={styles.h1}>
        Payment confirmed{name ? `, ${name}` : ''}!
      </E.Heading>
      <E.Text style={styles.paragraph}>
        Thanks for subscribing to <strong>{appName}</strong>. Your{' '}
        <strong>{planName}</strong> plan is now active.
      </E.Text>
      <E.Section style={styles.receiptBox}>
        <E.Text style={styles.receiptRow}>
          <span style={styles.receiptLabel}>Plan</span>
          <span>{planName}</span>
        </E.Text>
        <E.Text style={styles.receiptRow}>
          <span style={styles.receiptLabel}>Amount</span>
          <span>{formatted}</span>
        </E.Text>
        {periodEnd && (
          <E.Text style={styles.receiptRow}>
            <span style={styles.receiptLabel}>Renews</span>
            <span>{periodEnd.toLocaleDateString()}</span>
          </E.Text>
        )}
      </E.Section>
      <E.Button href={dashboardUrl} style={styles.button}>
        Go to Dashboard
      </E.Button>
      <E.Text style={styles.smallText}>
        Manage your subscription at any time from the billing page.
      </E.Text>
    </Layout>
  );
}

export function OnboardingDay3Email({
  name,
  appName,
  dashboardUrl,
  unsubscribeUrl
}: {
  name?: string | null;
  appName: string;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}) {
  return (
    <Layout
      appName={appName}
      preview={`Getting the most out of ${appName}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <E.Heading style={styles.h1}>
        Getting started{name ? `, ${name}` : ''}
      </E.Heading>
      <E.Text style={styles.paragraph}>
        You've been using <strong>{appName}</strong> for a few days. Here are
        some tips to help you get the most out of it.
      </E.Text>
      <E.Button href={dashboardUrl} style={styles.button}>
        Back to Dashboard
      </E.Button>
    </Layout>
  );
}

export function OnboardingDay7Email({
  name,
  appName,
  dashboardUrl,
  unsubscribeUrl
}: {
  name?: string | null;
  appName: string;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}) {
  return (
    <Layout
      appName={appName}
      preview={`How's it going with ${appName}?`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <E.Heading style={styles.h1}>
        How's it going{name ? `, ${name}` : ''}?
      </E.Heading>
      <E.Text style={styles.paragraph}>
        It's been a week since you joined <strong>{appName}</strong>. We'd love
        to hear how things are going and help you get even more value.
      </E.Text>
      <E.Button href={dashboardUrl} style={styles.button}>
        Go to Dashboard
      </E.Button>
    </Layout>
  );
}

export function TrialExpiringEmail({
  name,
  appName,
  daysLeft,
  billingUrl
}: {
  name?: string | null;
  appName: string;
  daysLeft: number;
  billingUrl: string;
}) {
  return (
    <Layout
      appName={appName}
      preview={`Your ${appName} trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
    >
      <E.Heading style={styles.h1}>
        Your trial ends soon{name ? `, ${name}` : ''}
      </E.Heading>
      <E.Text style={styles.paragraph}>
        Your <strong>{appName}</strong> trial expires in{' '}
        <strong>
          {daysLeft} day{daysLeft === 1 ? '' : 's'}
        </strong>
        . Upgrade now to keep access to all your data and features.
      </E.Text>
      <E.Button href={billingUrl} style={styles.button}>
        Upgrade Now
      </E.Button>
      <E.Text style={styles.smallText}>
        No action needed if you don't want to continue. Your data will be
        retained for 30 days after trial expiry.
      </E.Text>
    </Layout>
  );
}

export function ReengagementEmail({
  name,
  appName,
  dashboardUrl,
  unsubscribeUrl
}: {
  name?: string | null;
  appName: string;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}) {
  return (
    <Layout
      appName={appName}
      preview={`We miss you at ${appName}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <E.Heading style={styles.h1}>
        We miss you{name ? `, ${name}` : ''}
      </E.Heading>
      <E.Text style={styles.paragraph}>
        It's been a while since you last visited <strong>{appName}</strong>.
        Come back and see what's new , we've been busy building.
      </E.Text>
      <E.Button href={dashboardUrl} style={styles.button}>
        Come Back
      </E.Button>
    </Layout>
  );
}

export function LeadConfirmationEmail({ appName }: { appName: string }) {
  return (
    <Layout appName={appName} preview={`You're on the ${appName} list!`}>
      <E.Heading style={styles.h1}>You're on the list!</E.Heading>
      <E.Text style={styles.paragraph}>
        Thanks for your interest in <strong>{appName}</strong>. We'll reach out
        when we have updates.
      </E.Text>
    </Layout>
  );
}

export function ContactNotificationEmail({
  appName,
  name,
  email,
  message
}: {
  appName: string;
  name: string;
  email: string;
  message: string;
}) {
  return (
    <Layout appName={appName} preview={`New contact form message from ${name}`}>
      <E.Heading style={styles.h1}>New contact form message</E.Heading>
      <E.Text style={styles.paragraph}>
        <strong>{name}</strong> ({email}) sent a message via the {appName}{' '}
        contact form:
      </E.Text>
      <E.Section style={styles.receiptBox}>
        <E.Text style={styles.contactMessage}>{message}</E.Text>
      </E.Section>
    </Layout>
  );
}

const styles = {
  body: {
    backgroundColor: emailTheme.background,
    fontFamily: emailTheme.fontFamily
  },
  container: { maxWidth: '560px', margin: '0 auto', padding: '40px 20px' },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '40px',
    border: `1px solid ${emailTheme.border}`
  },
  footer: { textAlign: 'center' as const, marginTop: '24px' },
  footerText: { color: emailTheme.mutedForeground, fontSize: '12px' },
  footerLink: {
    color: emailTheme.mutedForeground,
    textDecoration: 'underline'
  },
  h1: {
    fontSize: '24px',
    fontWeight: '600',
    color: emailTheme.primaryColor,
    margin: '0 0 16px'
  },
  paragraph: {
    fontSize: '16px',
    color: emailTheme.foreground,
    lineHeight: '1.5',
    margin: '0 0 16px'
  },
  otpCode: {
    fontSize: '36px',
    fontWeight: '700',
    letterSpacing: '8px',
    textAlign: 'center' as const,
    color: emailTheme.primaryColor,
    backgroundColor: emailTheme.muted,
    borderRadius: '8px',
    padding: '16px',
    margin: '24px 0'
  },
  button: {
    backgroundColor: emailTheme.primaryColor,
    color: emailTheme.primaryForeground,
    borderRadius: '6px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '500',
    textDecoration: 'none',
    display: 'inline-block'
  },
  smallText: {
    fontSize: '12px',
    color: emailTheme.mutedForeground,
    margin: '16px 0 0'
  },
  receiptBox: {
    backgroundColor: emailTheme.muted,
    borderRadius: '6px',
    padding: '16px',
    margin: '0 0 24px'
  },
  receiptRow: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    fontSize: '14px',
    color: emailTheme.foreground,
    margin: '0 0 8px'
  },
  receiptLabel: { color: emailTheme.mutedForeground },
  contactMessage: {
    fontSize: '14px',
    color: emailTheme.foreground,
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap' as const,
    margin: 0
  }
};
