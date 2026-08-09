import type { UIMessage } from '@tanstack/ai';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { config } from '@/config';
import type { ChatMessageRecord } from '@/features/ai-chat';
import {
  ChatPanel,
  conversationMessagesQueryOptions,
  conversationsQueryOptions
} from '@/features/ai-chat';

export const Route = createFileRoute('/_app/dashboard/chat/$id')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      conversationMessagesQueryOptions(params.id)
    );
    return { localModelEnabled: config.ai.localModel };
  },
  component: ChatConversation
});

const toUIMessages = (records: ChatMessageRecord[]): UIMessage[] =>
  records.map(r => ({
    id: r.id,
    role: r.role,
    parts: [{ type: 'text' as const, content: r.content }],
    createdAt: new Date(r.created_at)
  }));

function ChatConversation() {
  const { id } = Route.useParams();
  const { localModelEnabled } = Route.useLoaderData();
  const { data: messages = [] } = useSuspenseQuery(
    conversationMessagesQueryOptions(id)
  );
  const { data: conversations = [] } = useSuspenseQuery(
    conversationsQueryOptions()
  );

  const title = conversations.find(c => c.id === id)?.title ?? 'Chat';

  return (
    <ChatPanel
      conversationId={id}
      conversationTitle={title}
      initialMessages={toUIMessages(messages)}
      key={id}
      localModelEnabled={localModelEnabled}
    />
  );
}
