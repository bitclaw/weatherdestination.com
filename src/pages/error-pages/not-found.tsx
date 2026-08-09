import { Link } from '@tanstack/react-router';
import { FileQuestion } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <FileQuestion className="text-muted-foreground h-16 w-16" />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Link
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
        to="/"
      >
        Go home
      </Link>
    </div>
  );
}
