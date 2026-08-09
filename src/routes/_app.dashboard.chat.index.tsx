import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { MessagesSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { createConversationFn } from '@/features/ai-chat';
import { conversationsQueryKey } from '@/lib/query-keys';

export const Route = createFileRoute('/_app/dashboard/chat/')({
  component: ChatIndex
});

function ChatIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleNewChat = async () => {
    const result = await createConversationFn({ data: { title: 'New Chat' } });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: conversationsQueryKey() });
    navigate({ to: '/dashboard/chat/$id', params: { id: result.data.id } });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-md border bg-card shadow-xs">
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-full border-2 border-border">
          <MessagesSquare className="size-8" />
        </div>
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-semibold">Your conversations</h2>
          <p className="text-sm text-muted-foreground">
            Select a conversation or start a new one.
          </p>
        </div>
        <Button onClick={handleNewChat}>New Chat</Button>
      </div>
    </div>
  );
}
