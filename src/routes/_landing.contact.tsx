import { createFileRoute, Link } from '@tanstack/react-router';
import { ContactForm } from '@/components/landing';
import { config } from '@/config';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

export const Route = createFileRoute('/_landing/contact')({
  beforeLoad: setPublicPageCacheHeader,
  head: () => ({
    meta: getSeoMeta({
      title: `Contact - ${config.appName}`,
      description: `Get in touch with the ${config.appName} team.`,
      url: `https://${config.domainName}/contact`
    })
  }),
  component: ContactPage
});

function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link
        className="text-muted-foreground hover:text-foreground mb-8 inline-block text-sm"
        to="/"
      >
        ← Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Contact</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Questions, feedback, or need help? Send us a message and we'll get back
        to you.
      </p>

      <div className="mt-8">
        <ContactForm />
      </div>
    </div>
  );
}
