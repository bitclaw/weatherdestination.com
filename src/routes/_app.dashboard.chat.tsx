import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import {
  ConversationsList,
  conversationsQueryOptions
} from '@/features/ai-chat';
import { PATHS } from '@/lib/constants';
import type { AppRouteContext } from '@/lib/types';

export const Route = createFileRoute('/_app/dashboard/chat')({
  loader: async ({ context }) => {
    const ctx = context as AppRouteContext;
    if (!ctx.flags.ai_chat_enabled) throw redirect({ to: PATHS.DASHBOARD });
    await context.queryClient.ensureQueryData(conversationsQueryOptions());
  },
  component: ChatLayout
});

function ChatLayout() {
  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main fixed>
        <section className="flex h-full gap-6">
          <ConversationsList />
          <Outlet />
        </section>
      </Main>
    </>
  );
}
