import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type SubscriberGrowthChartProps = {
  data: Array<{ month: string; new: number; cancelled: number }>;
};

export function SubscriberGrowthChart({ data }: SubscriberGrowthChartProps) {
  const hasData = data.some(d => d.new > 0 || d.cancelled > 0);

  if (!hasData) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
        No subscriber activity yet.
      </div>
    );
  }

  const chartData = data.map(d => ({
    name: d.month,
    new: d.new,
    cancelled: d.cancelled
  }));

  return (
    <ResponsiveContainer height={350} width="100%">
      <AreaChart data={chartData}>
        <XAxis
          axisLine={false}
          dataKey="name"
          fontSize={12}
          stroke="var(--muted-foreground)"
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          fontSize={12}
          stroke="var(--muted-foreground)"
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            fontSize: 12,
            backgroundColor: 'var(--popover)',
            borderColor: 'var(--border)',
            color: 'var(--popover-foreground)'
          }}
        />
        <Area
          className="fill-primary stroke-primary"
          dataKey="new"
          fillOpacity={0.15}
          name="New"
          type="monotone"
        />
        <Area
          className="fill-destructive stroke-destructive"
          dataKey="cancelled"
          fillOpacity={0.1}
          name="Cancelled"
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
