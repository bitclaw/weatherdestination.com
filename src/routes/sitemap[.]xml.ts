import { createFileRoute } from '@tanstack/react-router';
import { allPosts } from 'content-collections';
import { config } from '@/config';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => {
        const base = `https://${config.domainName}`;
        // Hand-maintained, not derived from the router - keep in sync with
        // src/routes/_landing.*.tsx. /login and /signup are deliberately
        // excluded: both are noindex (functional auth forms, no unique
        // content to rank on - see getSeoMeta's `noindex` param), and
        // noindex pages don't belong in the sitemap.
        const staticPaths = [
          '/',
          '/pricing',
          '/features',
          '/blog',
          '/changelog',
          '/compare/shipfast',
          '/compare/vercel-templates',
          '/tos',
          '/privacy',
          '/contact'
        ];
        const blogPaths = allPosts.map(p => `/blog/${p.slug}`);
        const urls = [...staticPaths, ...blogPaths];
        const urlset = urls
          .map(path => `  <url><loc>${base}${path}</loc></url>`)
          .join('\n');

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>`,
          {
            headers: {
              'Content-Type': 'application/xml',
              'Cache-Control': 'public, max-age=3600'
            }
          }
        );
      }
    }
  }
});
