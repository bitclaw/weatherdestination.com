import { createFileRoute } from '@tanstack/react-router';

// The URL path segment itself must equal INDEXNOW_KEY - that's the
// verification mechanism IndexNow's protocol requires (see
// docs/warpkit/features/indexnow.md). No DB/rate-limit needed: a public,
// low-value verification endpoint, not a mutation or data source.
export const Route = createFileRoute('/{$indexNowKey}.txt')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const key = process.env.INDEXNOW_KEY;
        if (!key || params.indexNowKey !== key) {
          return new Response('Not found', { status: 404 });
        }
        return new Response(key, {
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }
  }
});
