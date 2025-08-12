
'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { format } from 'date-fns';

interface ChartDataPoint {
    name: string;
    hours: number;
    status: 'worked' | 'day_off' | 'absent';
}

interface MonthlyHoursChartProps {
  data: ChartDataPoint[];
  dateRange: { from: Date; to: Date };
}

const getBarColor = (status: string) => {
    switch (status) {
        case 'worked':
            return '#16a34a'; // Green
        case 'day_off':
            return '#facc15'; // Yellow
        default:
            return 'transparent'; // No color for absent or no data
    }
};

export default function MonthlyHoursChart({ data, dateRange }: MonthlyHoursChartProps) {
  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="h" />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))' }}
            contentStyle={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
            }}
            labelFormatter={(label) => `${format(dateRange.from, 'MMMM')} ${label}`}
            formatter={(value: number, name: string, props: any) => [`${value} hours`, `Status: ${props.payload.status}`]}
          />
          <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.status)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
