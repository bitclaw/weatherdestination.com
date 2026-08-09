import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';

type RecentPaymentsProps = {
  payments: Array<{
    userId: string;
    name: string;
    plan: string;
    amountCents: number;
    createdAt: Date;
  }>;
};

const initials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

export function RecentPayments({ payments }: RecentPaymentsProps) {
  if (payments.length === 0) {
    return <p className="text-sm text-muted-foreground">No payments yet.</p>;
  }

  return (
    <div className="space-y-5">
      {payments.map(p => (
        <div className="flex items-center gap-4" key={p.userId + p.createdAt}>
          <Avatar className="h-9 w-9">
            <AvatarFallback>{initials(p.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium leading-none">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {relativeTime(p.createdAt.getTime())}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="capitalize" variant="outline">
                {p.plan}
              </Badge>
              <span className="text-sm font-semibold tabular-nums">
                +${(p.amountCents / 100).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
