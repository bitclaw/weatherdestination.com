import type { Post } from 'content-collections';

export const buildRobotsTxt = (domain: string): string =>
  `User-agent: *\nAllow: /\n\nSitemap: https://${domain}/sitemap.xml\n`;

// Hand-maintained, not derived from the router - keep in sync with
// src/routes/_landing.*.tsx. /login and /signup are deliberately excluded:
// both are noindex (functional auth forms, no unique content to rank on -
// see getSeoMeta's `noindex` param), and noindex pages don't belong in the
// sitemap.
const STATIC_SITEMAP_PATHS = [
  '/',
  '/pricing',
  '/features',
  '/compare',
  '/blog',
  '/changelog',
  '/tos',
  '/privacy',
  '/contact'
];

export const buildSitemapXml = (domain: string, posts: Post[]): string => {
  const base = `https://${domain}`;
  const blogPaths = posts.map(p => `/blog/${p.slug}`);
  const urls = [...STATIC_SITEMAP_PATHS, ...blogPaths];
  const urlset = urls
    .map(path => `  <url><loc>${base}${path}</loc></url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>`;
};
