import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { config } from '@/config';

// Not currently wired into any route/middleware (grepped: zero references
// outside this file) - kept for parity with error.tsx if a maintenance-mode
// gate is added later. The <Link> below assumes router context is
// available wherever this ends up mounted, same as error.tsx.
export function MaintenancePage() {
  return (
    <div className="h-svh">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <h1 className="text-[7rem] leading-tight font-bold">503</h1>
        <span className="font-medium">Website is under maintenance!</span>
        <p className="text-center text-muted-foreground">
          {config.appName} is not available at the moment. <br />
          We'll be back online shortly.
        </p>
        <div className="mt-6 flex gap-4">
          <Button asChild variant="outline">
            <Link to="/contact">Contact support</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
