import { Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';

type UpgradeGateProps = {
  hasAccess: boolean;
  children: React.ReactNode;
  message?: string;
};

export function UpgradeGate({
  hasAccess,
  children,
  message = 'This feature requires a Pro plan.'
}: UpgradeGateProps) {
  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-background/90 rounded-lg border p-4 text-center shadow-sm backdrop-blur-sm">
          <Lock className="text-muted-foreground mx-auto mb-2 h-5 w-5" />
          <p className="text-sm font-medium">{message}</p>
          <Link
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-3 inline-block rounded-md px-4 py-1.5 text-xs font-medium"
            search={{ success: undefined, canceled: undefined }}
            to="/dashboard/billing"
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
