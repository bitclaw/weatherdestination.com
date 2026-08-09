import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type MrrChartProps = {
  data: Array<{ month: string; mrrCents: number }>;
};

export function MrrChart({ data }: MrrChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No MRR history yet , snapshots accumulate monthly going forward.
      </div>
    );
  }

  const chartData = data.map(d => ({ name: d.month, mrr: d.mrrCents / 100 }));

  return (
    <ResponsiveContainer height={300} width="100%">
      <LineChart data={chartData}>
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
          tickFormatter={value => `$${value}`}
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
        <Line
          className="stroke-primary"
          dataKey="mrr"
          dot={false}
          strokeWidth={2}
          type="monotone"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
