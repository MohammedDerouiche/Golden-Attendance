
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { getDaysInMonth } from 'date-fns';
import { useMemo } from 'react';

interface AttendancePieChartProps {
  dailyData: { [key: string]: number };
  dateRange: { from: Date; to: Date };
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];
const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`(${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};


export default function AttendancePieChart({ dailyData, dateRange }: AttendancePieChartProps) {
    const chartData = useMemo(() => {
        const totalDaysInMonth = getDaysInMonth(dateRange.from);
        const presentDays = Object.keys(dailyData).length;
        const absentDays = totalDaysInMonth - presentDays;

        return [
            { name: 'Days Present', value: presentDays },
            { name: 'Days Absent', value: absentDays },
        ];
    }, [dailyData, dateRange]);


  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
           <Tooltip
                contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                }}
            />
          <Legend iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
