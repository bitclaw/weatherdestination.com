import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/ping')({
  server: {
    handlers: {
      GET: () => new Response('pong')
    }
  }
});
