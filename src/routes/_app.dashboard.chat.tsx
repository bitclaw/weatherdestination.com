import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import {
  ConversationsList,
  conversationsQueryOptions
} from '@/features/ai-chat';

export const Route = createFileRoute('/_app/dashboard/chat')({
  loader: async ({ context }) => {
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
