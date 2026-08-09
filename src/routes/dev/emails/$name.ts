import { render } from '@react-email/render';
import { createFileRoute } from '@tanstack/react-router';
import { config } from '@/config';
import {
  ContactNotificationEmail,
  LeadConfirmationEmail,
  MagicLinkEmail,
  OnboardingDay3Email,
  OnboardingDay7Email,
  OtpEmail,
  ReceiptEmail,
  ReengagementEmail,
  TrialExpiringEmail,
  WelcomeEmail
} from '@/server/email-templates';

const appName = config.appName;

const TEMPLATES: Record<string, React.ReactElement> = {
  otp: OtpEmail({ otp: '123456', appName }),
  'magic-link': MagicLinkEmail({
    url: 'http://localhost:3000/auth/verify?token=preview',
    appName
  }),
  welcome: WelcomeEmail({
    name: 'Alice',
    appName,
    dashboardUrl: 'http://localhost:3000/dashboard'
  }),
  receipt: ReceiptEmail({
    name: 'Alice',
    appName,
    planName: config.stripe.plans[0]?.name ?? 'Pro',
    amount: 2900,
    currency: 'usd',
    dashboardUrl: 'http://localhost:3000/dashboard'
  }),
  'onboarding-day3': OnboardingDay3Email({
    name: 'Alice',
    appName,
    dashboardUrl: 'http://localhost:3000/dashboard'
  }),
  'onboarding-day7': OnboardingDay7Email({
    name: 'Alice',
    appName,
    dashboardUrl: 'http://localhost:3000/dashboard'
  }),
  'trial-expiring': TrialExpiringEmail({
    name: 'Alice',
    appName,
    daysLeft: 3,
    billingUrl: 'http://localhost:3000/dashboard/billing'
  }),
  reengagement: ReengagementEmail({
    name: 'Alice',
    appName,
    dashboardUrl: 'http://localhost:3000/dashboard'
  }),
  'lead-confirmation': LeadConfirmationEmail({ appName }),
  'contact-notification': ContactNotificationEmail({
    appName,
    name: 'Alice',
    email: 'alice@example.com',
    message:
      'Hi, I ran into an issue setting up billing and could use some help.'
  })
};

export const Route = createFileRoute('/dev/emails/$name')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (process.env.NODE_ENV === 'production') {
          return new Response('Not found', { status: 404 });
        }

        const template = TEMPLATES[params.name];
        if (!template) {
          return new Response(
            `Unknown template "${params.name}". Available: ${Object.keys(TEMPLATES).join(', ')}`,
            { status: 404 }
          );
        }

        const html = await render(template);
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }
  }
});
