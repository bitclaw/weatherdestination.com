import { createFileRoute } from '@tanstack/react-router';
import { allPosts } from 'content-collections';
import { config } from '@/config';
import { buildSitemapXml } from '@/lib/seo-static';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(buildSitemapXml(config.domainName, allPosts), {
          headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600'
          }
        })
    }
  }
});
