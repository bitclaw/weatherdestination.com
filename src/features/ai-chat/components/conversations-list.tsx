import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useMatch, useNavigate } from '@tanstack/react-router';
import { Edit, MessageSquare, Search, Trash2 } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/toast';
import {
  conversationMessagesQueryOptions,
  conversationsQueryOptions,
  createConversationFn,
  deleteConversationFn
} from '@/features/ai-chat';
import { conversationsQueryKey } from '@/lib/query-keys';
import { cn, relativeTime } from '@/lib/utils';

export const ConversationsList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: conversations = [] } = useSuspenseQuery(
    conversationsQueryOptions()
  );

  const chatMatch = useMatch({
    from: '/_app/dashboard/chat/$id',
    shouldThrow: false
  });
  const activeId = chatMatch?.params.id;

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const filtered = deferredSearch
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(deferredSearch.toLowerCase())
      )
    : conversations;

  const handleNewChat = async () => {
    const result = await createConversationFn({
      data: { title: 'New Chat' }
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: conversationsQueryKey() });
    navigate({ to: '/dashboard/chat/$id', params: { id: result.data.id } });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteConversationFn({
      data: { conversationId: deleteTarget }
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: conversationsQueryKey() });
    if (activeId === deleteTarget) {
      navigate({ to: '/dashboard/chat' });
    }
    setDeleteTarget(null);
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:w-56 lg:w-72">
      <div className="sticky top-0 z-10 bg-background pb-2">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Chats</h2>
            <MessageSquare className="text-muted-foreground" size={18} />
          </div>
          <Button
            className="rounded-lg"
            onClick={handleNewChat}
            size="icon"
            variant="ghost"
          >
            <Edit className="stroke-muted-foreground" size={18} />
          </Button>
        </div>
      </div>

      <div className="relative pb-2">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 rounded-lg pl-9 text-sm"
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations..."
          value={search}
        />
      </div>

      <ScrollArea className="-mx-2 h-full px-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? 'No matching conversations.' : 'No conversations yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map(conv => (
              <div
                className={cn(
                  'group flex items-center gap-1 rounded-md px-2 py-2 text-sm hover:bg-accent',
                  activeId === conv.id && 'bg-muted'
                )}
                key={conv.id}
              >
                <button
                  className="min-w-0 flex-1 text-start"
                  onClick={() =>
                    navigate({
                      to: '/dashboard/chat/$id',
                      params: { id: conv.id }
                    })
                  }
                  onMouseEnter={() =>
                    queryClient.prefetchQuery(
                      conversationMessagesQueryOptions(conv.id)
                    )
                  }
                  type="button"
                >
                  <p className="truncate font-medium">{conv.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {relativeTime(conv.updated_at ?? conv.created_at)}
                  </p>
                </button>
                <Button
                  className="size-7 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={e => {
                    e.stopPropagation();
                    setDeleteTarget(conv.id);
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="stroke-muted-foreground" size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <ConfirmDialog
        confirmLabel="Delete"
        description="This will permanently delete this conversation and all its messages."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        open={deleteTarget !== null}
        title="Delete conversation"
        variant="destructive"
      />
    </div>
  );
};
