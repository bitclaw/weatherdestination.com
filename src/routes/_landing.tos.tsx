import { createFileRoute, Link } from '@tanstack/react-router';
import { config } from '@/config';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

export const Route = createFileRoute('/_landing/tos')({
  beforeLoad: setPublicPageCacheHeader,
  head: () => ({
    meta: getSeoMeta({
      title: `Terms of Service - ${config.appName}`,
      description: `Read the terms of service for ${config.appName}.`,
      url: `https://${config.domainName}/tos`
    })
  }),
  component: TosPage
});

function TosPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link
        className="text-muted-foreground hover:text-foreground mb-8 inline-block text-sm"
        to="/"
      >
        ← Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Terms of Service</h1>
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
          By using {config.appName}, you agree to these terms. Please read them
          carefully.
        </p>

        <h2>Use of Service</h2>
        <p>
          You may use {config.appName} for lawful purposes only. You are
          responsible for all content and activity under your account.
        </p>

        <h2>Accounts</h2>
        <p>
          You must provide accurate information when creating an account. You
          are responsible for maintaining the security of your account.
        </p>

        <h2>Payments</h2>
        <p>
          Paid plans are billed in advance. Refunds are handled at our
          discretion. We reserve the right to change pricing with 30 days
          notice.
        </p>

        <h2>Termination</h2>
        <p>
          We reserve the right to terminate accounts that violate these terms.
          You may cancel your account at any time.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          {config.appName} is provided "as is" without warranties of any kind.
          We are not liable for any indirect, incidental, or consequential
          damages arising from your use of the service.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? <Link to="/contact">Contact us</Link>.
        </p>
      </div>
    </div>
  );
}
