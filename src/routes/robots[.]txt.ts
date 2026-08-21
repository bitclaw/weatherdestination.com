import { createFileRoute } from '@tanstack/react-router';
import { config } from '@/config';
import { buildRobotsTxt } from '@/lib/seo-static';

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(buildRobotsTxt(config.domainName), {
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=86400'
          }
        })
    }
  }
});
