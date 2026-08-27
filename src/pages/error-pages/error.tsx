import { captureException } from '@sentry/tanstackstart-react';
import { Link } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

type Props = {
  error: unknown;
  reset?: () => void;
  // Set when the caller (Sentry's own <ErrorBoundary fallback>) already
  // captured the exception and computed an event id itself - skips this
  // component's own captureException call so the same error isn't reported
  // twice under two different event ids.
  eventId?: string | null;
};

export function ErrorPage({ error, reset, eventId: providedEventId }: Props) {
  const [eventId, setEventId] = useState<string | null>(
    providedEventId ?? null
  );

  useEffect(() => {
    if (providedEventId !== undefined) return;
    setEventId(captureException(error));
  }, [error, providedEventId]);

  const message =
    error instanceof Error && process.env.NODE_ENV === 'development'
      ? error.message
      : 'An unexpected error occurred.';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <AlertTriangle className="text-destructive h-16 w-16" />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
        {eventId && (
          <p className="text-muted-foreground text-xs">
            Reference ID: <code className="font-mono">{eventId}</code>
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {reset && (
          <button
            className="hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        )}
        <a
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
          href="/"
        >
          Go home
        </a>
        <Link
          className="hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium"
          to="/contact"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
