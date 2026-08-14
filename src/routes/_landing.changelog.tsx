import { createFileRoute, Link } from '@tanstack/react-router';
import { allReleases } from 'content-collections';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { Markdown } from '@/components/Markdown';
import { config } from '@/config';
import { renderChatMarkdown } from '@/lib/markdown';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

export const Route = createFileRoute('/_landing/changelog')({
  beforeLoad: setPublicPageCacheHeader,
  head: () => ({
    meta: getSeoMeta({
      title: `Changelog - ${config.appName}`,
      description: `What's new in ${config.appName}. Release notes and version history.`,
      url: `https://${config.domainName}/changelog`
    }),
    links: [
      { rel: 'canonical', href: `https://${config.domainName}/changelog` }
    ]
  }),
  component: ChangelogPage
});

const TAG_COLORS: Record<string, string> = {
  core: 'bg-info/10 text-info dark:bg-info/20',
  breaking: 'bg-destructive/10 text-destructive dark:bg-destructive/20',
  beta: 'bg-warning/10 text-warning dark:bg-warning/20',
  fix: 'bg-success/10 text-success dark:bg-success/20'
};

function ChangelogPage() {
  const releases = [...allReleases].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <main className="pt-20">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <Link
            className="text-muted-foreground hover:text-foreground mb-8 inline-block text-sm transition-colors"
            to="/"
          >
            ← Back to home
          </Link>
          <h1 className="mt-4 text-4xl font-bold tracking-tight">Changelog</h1>
          <p className="text-muted-foreground mt-3">
            What's new in {config.appName}.
          </p>

          <div className="mt-12 space-y-12">
            {releases.map(release => (
              <div
                className="border-border relative border-l pl-6"
                key={release.version}
              >
                <div className="bg-border absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full" />

                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="bg-muted border-border rounded border px-2 py-0.5 font-mono text-sm font-semibold">
                    v{release.version}
                  </span>
                  <time
                    className="text-muted-foreground text-sm"
                    dateTime={release.date}
                  >
                    {new Date(release.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'UTC'
                    })}
                  </time>
                  {release.tags.map((tag: string) => (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        TAG_COLORS[tag] ?? 'bg-muted text-muted-foreground'
                      }`}
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <h2 className="text-xl font-semibold">{release.title}</h2>
                <div className="mt-2 text-sm">
                  <Markdown html={renderChatMarkdown(release.content)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
