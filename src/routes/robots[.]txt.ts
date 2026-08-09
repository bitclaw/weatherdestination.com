import { createFileRoute } from '@tanstack/react-router';
import { config } from '@/config';

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(
          `User-agent: *\nAllow: /\n\nSitemap: https://${config.domainName}/sitemap.xml\n`,
          {
            headers: {
              'Content-Type': 'text/plain',
              'Cache-Control': 'public, max-age=86400'
            }
          }
        )
    }
  }
});
