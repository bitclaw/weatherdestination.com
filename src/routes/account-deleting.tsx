import { createFileRoute } from '@tanstack/react-router';
import { config } from '@/config';

export const Route = createFileRoute('/account-deleting')({
  component: AccountDeletingPage
});

function AccountDeletingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold">{config.appName}</h1>
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-3">
          <h2 className="text-xl font-semibold">
            Account deletion in progress
          </h2>
          <p className="text-muted-foreground text-sm">
            Your account is being deleted. This usually completes in a few
            seconds. You will be signed out automatically once the process
            finishes.
          </p>
          <p className="text-muted-foreground text-xs">
            Contact support if this message persists.
          </p>
        </div>
      </div>
    </div>
  );
}
