import { Progress } from '@/components/ui/progress';

type PlanDistributionProps = {
  data: Array<{ plan: string; count: number }>;
};

export function PlanDistribution({ data }: PlanDistributionProps) {
  const total = data.reduce((sum, p) => sum + p.count, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active subscribers yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {data.map(plan => {
        const pct = Math.round((plan.count / total) * 100);
        return (
          <div className="space-y-1.5" key={plan.plan}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium capitalize">{plan.plan}</span>
              <span className="tabular-nums text-muted-foreground">
                {plan.count} users · {pct}%
              </span>
            </div>
            <Progress value={pct} />
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground pt-1">
        {total} paying subscribers total
      </p>
    </div>
  );
}
