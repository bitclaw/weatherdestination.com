import {
  chat,
  chatParamsFromRequest,
  toServerSentEventsResponse
} from '@tanstack/ai';
import { openRouterText } from '@tanstack/ai-openrouter';
import { createFileRoute } from '@tanstack/react-router';
import { config } from '@/config';
import { validateChatMessages } from '@/features/ai-chat/ai-chat.constants';
import { auth } from '@/server/auth';
import { createRateLimiter } from '@/server/rate-limit';
import { isSameOriginRequest } from '@/server/verify-same-origin';

const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export const Route = createFileRoute('/api/v1/ai-chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // src/start.ts's csrfMiddleware only covers TanStack server
        // functions, not file-route API handlers like this one - see
        // verify-same-origin.ts for why. This is a cookie-authenticated,
        // credit/API-quota-consuming endpoint, so it needs its own check.
        if (!isSameOriginRequest(request)) {
          return new Response('Forbidden', { status: 403 });
        }

        const session = await auth.api.getSession({
          headers: request.headers
        });
        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        // Not reached through _app.dashboard.chat.tsx's beforeLoad (this is
        // a direct fetch() endpoint, not a router page), so it needs its
        // own explicit check rather than inheriting the route guard.
        // Named flagsDb, not db, so it doesn't shadow the per-block `db`
        // re-imports further down (credit deduction/refund).
        const { db: flagsDb } = await import('@/lib/db');
        const { getFlagEnabled } = await import(
          '@/features/feature-flags/server/feature-flags.server'
        );
        if (!(await getFlagEnabled(flagsDb, 'ai_chat_enabled'))) {
          return new Response('Not found', { status: 404 });
        }

        // Keyed by user id, not IP - this is an authenticated, paid-API-billed
        // endpoint. IP-keying would let users behind a shared IP (NAT, CGNAT)
        // throttle each other, and let one account bypass the cap entirely by
        // rotating a spoofable IP header.
        if (limiter.check(session.user.id)) {
          return new Response('Too many requests', { status: 429 });
        }

        if (!process.env.OPENROUTER_API_KEY) {
          return new Response('AI service not configured', { status: 503 });
        }

        let params: Awaited<ReturnType<typeof chatParamsFromRequest>>;
        try {
          params = await chatParamsFromRequest(request);
        } catch (err) {
          console.warn('ai-chat: failed to parse request body', err);
          return new Response('Invalid request body', { status: 400 });
        }

        const validation = validateChatMessages(params.messages);
        if (!validation.ok) {
          return new Response(validation.error, { status: 400 });
        }

        if (config.credits.enabled) {
          const { db } = await import('@/lib/db');
          const { deductCredit } = await import(
            '@/features/credits/server/credits.server'
          );
          const deducted = await deductCredit(db, session.user.id);
          if (!deducted.ok) {
            return new Response('Insufficient credits', { status: 402 });
          }
          const { invalidateBootstrapCache } = await import(
            '@/server/functions/bootstrap-cache'
          );
          invalidateBootstrapCache(session.user.id);
        }

        // Shared controller: aborts the upstream OpenRouter fetch (wired via
        // chat()'s abortController param) when the client disconnects mid-
        // stream (wired via toServerSentEventsResponse's cancel() handler) -
        // otherwise a closed tab leaves the upstream request running to
        // completion, generating billed tokens nobody reads.
        const abortController = new AbortController();

        try {
          const stream = chat({
            adapter: openRouterText(config.ai.model),
            systemPrompts: [config.ai.systemPrompt],
            messages: params.messages,
            modelOptions: { maxCompletionTokens: 2048 },
            abortController
          });

          return toServerSentEventsResponse(stream, { abortController });
        } catch (err) {
          console.error('ai-chat: failed to start stream', err);
          // chat() threw before any tokens streamed - refund the credit
          // deducted above (line ~56), otherwise a user is charged for a
          // request that never actually ran.
          if (config.credits.enabled) {
            const { refundCredit } = await import(
              '@/features/credits/server/credits.server'
            );
            const { db } = await import('@/lib/db');
            await refundCredit(db, session.user.id);
            const { invalidateBootstrapCache } = await import(
              '@/server/functions/bootstrap-cache'
            );
            invalidateBootstrapCache(session.user.id);
          }
          return new Response('AI service error', { status: 502 });
        }
      }
    }
  }
});
