import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { Markdown } from '@/components/Markdown';
import { Badge } from '@/components/ui/badge';
import { config } from '@/config';
import { getPostFn } from '@/features/blog';
import { getJsonLd, getSeoMeta, stringifyJsonLd } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

export const Route = createFileRoute('/_landing/blog/$slug')({
  beforeLoad: setPublicPageCacheHeader,
  loader: async ({ params }) => {
    const result = await getPostFn({ data: { slug: params.slug } });
    if (!result.ok) throw notFound();
    return { post: result.data };
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) return {};
    const jsonLd = getJsonLd({
      type: 'Article',
      name: post.title,
      description: post.description,
      url: `https://${config.domainName}/blog/${post.slug}`,
      datePublished: post.published,
      author: post.authors[0]
    });
    return {
      meta: getSeoMeta({
        title: `${post.title} - ${config.appName} Blog`,
        description: post.description,
        url: `https://${config.domainName}/blog/${post.slug}`,
        type: 'article'
      }),
      links: [
        {
          rel: 'canonical',
          href: `https://${config.domainName}/blog/${post.slug}`
        }
      ],
      scripts: [
        { type: 'application/ld+json', children: stringifyJsonLd(jsonLd) }
      ]
    };
  },
  component: BlogPost,
  notFoundComponent: () => (
    <div className="min-h-screen">
      <LandingNavbar />
      <main className="pt-20">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="text-2xl font-bold">Post not found</h1>
          <p className="text-muted-foreground mt-2">
            This blog post doesn't exist.
          </p>
          <Link
            className="text-primary mt-4 inline-block hover:underline"
            to="/blog"
          >
            Back to blog
          </Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  )
});

function BlogPost() {
  const { post } = Route.useLoaderData();

  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <main className="pt-20">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <Link
            className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1 text-sm"
            to="/blog"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to blog
          </Link>

          <header className="mt-4">
            <div className="flex items-center gap-2">
              <time className="text-muted-foreground text-sm">
                {new Date(post.published).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC'
                })}
              </time>
              <Badge className="capitalize" variant="secondary">
                {post.category}
              </Badge>
            </div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {post.title}
            </h1>
            {post.authors.length > 0 && (
              <p className="text-muted-foreground mt-2 text-sm">
                By {post.authors.join(', ')}
              </p>
            )}
          </header>

          {post.headings.length > 3 && (
            <nav className="mt-8 rounded-lg border p-4">
              <h2 className="text-sm font-semibold">Table of Contents</h2>
              <ul className="mt-2 space-y-1">
                {post.headings
                  .filter((h: { level: number }) => h.level <= 3)
                  .map(
                    (heading: { id: string; text: string; level: number }) => (
                      <li
                        key={heading.id}
                        style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
                      >
                        <a
                          className="text-muted-foreground hover:text-foreground text-sm"
                          href={`#${heading.id}`}
                        >
                          {heading.text}
                        </a>
                      </li>
                    )
                  )}
              </ul>
            </nav>
          )}

          <article className="mt-8">
            <Markdown html={post.html} />
          </article>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
