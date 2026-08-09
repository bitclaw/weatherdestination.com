import { queryOptions } from '@tanstack/react-query';
import {
  conversationMessagesQueryKey,
  conversationsQueryKey
} from '@/lib/query-keys';
import {
  getConversationMessagesFn,
  listConversationsFn
} from './server/ai-chat.queries';

export const conversationsQueryOptions = () =>
  queryOptions({
    queryKey: conversationsQueryKey(),
    queryFn: async () => {
      const result = await listConversationsFn();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: 30_000
  });

export const conversationMessagesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: conversationMessagesQueryKey(id),
    queryFn: async () => {
      const result = await getConversationMessagesFn({
        data: { conversationId: id }
      });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: 0
  });

export { ChatPanel } from './components/chat-panel';
export { ConversationsList } from './components/conversations-list';
export {
  createConversationFn,
  deleteConversationFn,
  saveMessageFn,
  updateConversationTitleFn
} from './server/ai-chat.mutations';
export type { ChatMessageRecord } from './server/ai-chat.server';
