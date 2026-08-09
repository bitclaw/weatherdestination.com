import { Link } from '@tanstack/react-router';

type EntitlementGateProps = {
  allowed: boolean;
  used: number;
  limit: number;
  resource: string;
  children: React.ReactNode;
};

export const EntitlementGate = ({
  allowed,
  used,
  limit,
  resource,
  children
}: EntitlementGateProps) => {
  if (allowed) return <>{children}</>;

  return (
    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
      <p>
        You've used {used}/{limit} {resource}. Upgrade your plan to create more.
      </p>
      <Link
        className="mt-1 inline-block text-primary underline hover:no-underline"
        search={{ success: undefined, canceled: undefined }}
        to="/dashboard/billing"
      >
        View plans
      </Link>
    </div>
  );
};
