import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { allPosts } from 'content-collections';
import { z } from 'zod';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { Badge } from '@/components/ui/badge';
import { config } from '@/config';
import { getSeoMeta } from '@/lib/seo';
import { setPublicPageCacheHeader } from '@/lib/ssr-cache-headers';

const searchSchema = z.object({
  category: z.string().optional()
});

export const Route = createFileRoute('/_landing/blog/')({
  validateSearch: searchSchema,
  beforeLoad: setPublicPageCacheHeader,
  component: BlogIndex,
  head: () => ({
    meta: getSeoMeta({
      title: `Blog - Engineering Articles - ${config.appName}`,
      description:
        'Articles on building and shipping SaaS products: architecture decisions, engineering tradeoffs, and lessons from running Warpkit in production.',
      url: `https://${config.domainName}/blog`
    }),
    links: [{ rel: 'canonical', href: `https://${config.domainName}/blog` }]
  })
});

function BlogIndex() {
  const { category: activeCategory } = useSearch({ from: '/_landing/blog/' });

  const sortedPosts = [...allPosts].sort(
    (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()
  );

  const categories = Array.from(
    new Set(sortedPosts.map(p => p.category))
  ).sort();

  const filteredPosts = activeCategory
    ? sortedPosts.filter(p => p.category === activeCategory)
    : sortedPosts;

  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <main className="pt-20">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
          <p className="text-muted-foreground mt-4">
            Articles on building and shipping SaaS products.
          </p>

          {categories.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  !activeCategory
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                search={{}}
                to="/blog"
              >
                All
              </Link>
              {categories.map(cat => (
                <Link
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  key={cat}
                  search={{ category: cat }}
                  to="/blog"
                >
                  {cat}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-12 space-y-10">
            {filteredPosts.map(post => (
              <article key={post.slug}>
                <Link
                  className="group block"
                  params={{ slug: post.slug }}
                  to="/blog/$slug"
                >
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
                  <h2 className="mt-1 text-xl font-semibold group-hover:underline">
                    {post.title}
                  </h2>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {post.description}
                  </p>
                </Link>
              </article>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <p className="text-muted-foreground mt-12 text-center">
              No posts in this category yet.
            </p>
          )}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
