import { createFileRoute, Link } from '@tanstack/react-router';
import { config } from '@/config';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

export const Route = createFileRoute('/_landing/privacy')({
  beforeLoad: setPublicPageCacheHeader,
  head: () => ({
    meta: getSeoMeta({
      title: `Privacy Policy - ${config.appName}`,
      description: `Read the privacy policy for ${config.appName}.`,
      url: `https://${config.domainName}/privacy`
    })
  }),
  component: PrivacyPage
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link
        className="text-muted-foreground hover:text-foreground mb-8 inline-block text-sm"
        to="/"
      >
        ← Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated:{' '}
        {new Date(config.legal.effectiveDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC'
        })}
      </p>

      <div className="prose prose-neutral dark:prose-invert mt-8">
        <p>
          {config.appName} ("we", "us", or "our") operates {config.domainName}.
          This page informs you of our policies regarding the collection, use,
          and disclosure of personal information when you use our service.
        </p>

        <h2>Information We Collect</h2>
        <p>
          We collect your email address when you sign up and any profile
          information you choose to provide. We use Stripe to process payments:
          your payment information is handled directly by Stripe and is never
          stored on our servers.
        </p>

        <h2>How We Use Your Information</h2>
        <ul>
          <li>To provide and maintain our service</li>
          <li>To send transactional emails (login codes, receipts)</li>
          <li>To process payments via Stripe</li>
          <li>To respond to support requests</li>
        </ul>

        <h2>Data Storage</h2>
        <p>
          Your data is stored on servers located in the European Union. We do
          not sell your personal information to third parties.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? <Link to="/contact">Contact us</Link>.
        </p>
      </div>
    </div>
  );
}
