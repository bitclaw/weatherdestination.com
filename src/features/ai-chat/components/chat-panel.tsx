import type { UIMessage } from '@tanstack/ai';
import { fetchServerSentEvents, useChat } from '@tanstack/ai-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Bot, Square } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { saveMessageFn, updateConversationTitleFn } from '@/features/ai-chat';
import { renderChatMarkdown } from '@/lib/markdown';
import { conversationsQueryKey } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

// ---- Chrome built-in LLM types -------------------------------------------

declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: global augmentation requires interface
  interface Window {
    LanguageModel?: {
      availability: () => Promise<
        'no' | 'readily' | 'available' | 'after-download' | 'downloadable'
      >;
      create: (opts?: {
        systemPrompt?: string;
        expectedOutputLanguages?: string[];
      }) => Promise<{
        promptStreaming: (input: string) => ReadableStream<string>;
        destroy: () => void;
      }>;
    };
  }
}

// ---- useLocalChat hook ----------------------------------------------------

type LocalChatState = {
  messages: UIMessage[];
  isLoading: boolean;
  error: Error | undefined;
  sendMessage: (content: string) => Promise<string | undefined>;
  stop: () => void;
  clear: () => void;
};

const useLocalChat = (opts: {
  systemPrompt: string;
  initialMessages: UIMessage[];
}): LocalChatState => {
  const [messages, setMessages] = useState<UIMessage[]>(opts.initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = async (content: string) => {
    setError(undefined);
    setIsLoading(true);
    abortRef.current = new AbortController();

    const userMsg: UIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', content }],
      createdAt: new Date()
    };
    setMessages(prev => [...prev, userMsg]);

    const assistantId = crypto.randomUUID();
    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        parts: [{ type: 'text', content: '' }],
        createdAt: new Date()
      }
    ]);

    try {
      const session = await window.LanguageModel!.create({
        systemPrompt: opts.systemPrompt,
        expectedOutputLanguages: ['en']
      });

      const stream = session.promptStreaming(content);
      const reader = stream.getReader();
      let fullContent = '';

      while (true) {
        if (abortRef.current.signal.aborted) {
          // Matches handleSend's `if (result !== undefined)` save guard -
          // an aborted stream is a cancellation, not a (possibly empty or
          // truncated) completed response, and shouldn't be persisted.
          session.destroy();
          return undefined;
        }
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += value;
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, parts: [{ type: 'text', content: fullContent }] }
              : m
          )
        );
      }

      session.destroy();
      return fullContent;
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const clear = () => setMessages([]);

  return { messages, isLoading, error, sendMessage, stop, clear };
};

// ---- RenderedMarkdown (memoized so processSync only runs when content changes) ----

const RenderedMarkdown = memo(({ content }: { content: string }) => (
  <div
    className="prose prose-sm dark:prose-invert max-w-none"
    // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by rehype-sanitize
    dangerouslySetInnerHTML={{ __html: renderChatMarkdown(content) }}
  />
));

// ---- ChatPanel ------------------------------------------------------------

type Props = {
  conversationId: string;
  initialMessages: UIMessage[];
  conversationTitle: string;
  localModelEnabled?: boolean;
};

export const ChatPanel = ({
  conversationId,
  initialMessages,
  conversationTitle,
  localModelEnabled = false
}: Props) => {
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const [localAvailable, setLocalAvailable] = useState(false);
  const [localMode, setLocalMode] = useState(false);

  // Detect Chrome built-in LLM (only when admin has opted in via config.ai.localModel)
  useEffect(() => {
    if (
      !localModelEnabled ||
      typeof window === 'undefined' ||
      !window.LanguageModel
    )
      return;
    window.LanguageModel.availability().then(status => {
      setLocalAvailable(status === 'readily' || status === 'available');
    });
  }, [localModelEnabled]);

  const onFinish = async (msg: UIMessage) => {
    const textPart = msg.parts.find(p => p.type === 'text');
    if (textPart?.type !== 'text') return;
    const result = await saveMessageFn({
      data: {
        messageId: msg.id,
        conversationId,
        role: 'assistant',
        content: textPart.content
      }
    });
    if (!result.ok) {
      // The response is already rendered from the streaming hook's local
      // state - this failure means it won't survive a reload, not that the
      // user doesn't see it now.
      toast.error("Response wasn't saved and may not survive a reload.");
    }
  };

  const cloud = useChat({
    connection: fetchServerSentEvents('/api/v1/ai-chat'),
    initialMessages,
    onFinish
  });

  const local = useLocalChat({
    systemPrompt:
      "You are a helpful AI assistant running directly in the user's browser using Chrome's built-in Gemma Nano model. You run entirely on-device with no server round-trip.",
    initialMessages
  });

  const { messages, isLoading, error, stop } = localMode ? local : cloud;

  const isFirstMessage = messages.filter(m => m.role === 'user').length === 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll triggered on every messages update including streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isLoading) return;
    setInput('');

    const saved = await saveMessageFn({
      data: {
        messageId: crypto.randomUUID(),
        conversationId,
        role: 'user',
        content
      }
    });
    if (!saved.ok) {
      toast.error(saved.message);
      return;
    }

    // Auto-title on first message
    if (isFirstMessage && conversationTitle === 'New Chat') {
      const title = content.slice(0, 60);
      await updateConversationTitleFn({
        data: { conversationId, title }
      });
      await queryClient.invalidateQueries({
        queryKey: conversationsQueryKey()
      });
    }

    if (localMode) {
      const result = await local.sendMessage(content);
      if (result !== undefined) {
        const assistantSaved = await saveMessageFn({
          data: {
            messageId: crypto.randomUUID(),
            conversationId,
            role: 'assistant',
            content: result
          }
        });
        if (!assistantSaved.ok) {
          toast.error("Response wasn't saved and may not survive a reload.");
        }
      }
    } else {
      await cloud.sendMessage(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-md border bg-card shadow-xs">
      {/* Header */}
      <div className="flex flex-none items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="text-muted-foreground" size={18} />
          <span className="text-sm font-medium">{conversationTitle}</span>
        </div>
        {localAvailable && (
          <Button
            className="h-7 text-xs"
            onClick={() => setLocalMode(m => !m)}
            size="sm"
            variant={localMode ? 'default' : 'outline'}
          >
            {localMode ? 'Local model' : 'Cloud model'}
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-2">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Ask me anything...
          </p>
        )}
        {messages.map(msg => {
          const textPart = msg.parts.find(p => p.type === 'text');
          const content =
            textPart && textPart.type === 'text' ? textPart.content : '';
          const isUser = msg.role === 'user';
          const isStreamingThis =
            isLoading && !isUser && msg.id === messages.at(-1)?.id;

          return (
            <div
              className={cn(
                'max-w-[75%] px-3 py-2 text-sm wrap-break-word shadow-sm',
                isUser
                  ? 'self-end rounded-[16px_16px_0_16px] bg-primary/90 text-primary-foreground/90'
                  : 'self-start rounded-[16px_16px_16px_0] bg-muted'
              )}
              key={msg.id}
            >
              {isStreamingThis || isUser ? (
                content || <span className="animate-pulse">•••</span>
              ) : (
                <RenderedMarkdown content={content} />
              )}
            </div>
          );
        })}
        {isLoading && messages.at(-1)?.role === 'user' && (
          <div className="self-start rounded-[16px_16px_16px_0] bg-muted px-3 py-2 text-sm shadow-sm">
            <span className="animate-pulse">•••</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="px-4 text-xs text-destructive">Error: {error.message}</p>
      )}

      {/* Input */}
      <div className="flex flex-none gap-2 border-t px-4 py-3">
        <div className="flex flex-1 items-end gap-2 rounded-md border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
          <textarea
            className="max-h-32 flex-1 resize-none bg-transparent text-sm focus-visible:outline-none"
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            ref={textareaRef}
            rows={1}
            style={{ fieldSizing: 'content' } as React.CSSProperties}
            value={input}
          />
        </div>
        {isLoading ? (
          <Button
            className="shrink-0 self-end"
            onClick={stop}
            size="icon"
            variant="outline"
          >
            <Square size={16} />
          </Button>
        ) : (
          <Button
            className="shrink-0 self-end"
            disabled={!input.trim()}
            onClick={handleSend}
            size="icon"
          >
            <ArrowUp size={16} />
          </Button>
        )}
      </div>
    </div>
  );
};
