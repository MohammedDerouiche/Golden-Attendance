
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useMemo } from 'react';
import type { Task, TaskStatus } from '@/lib/supabase/types';

interface TaskStatusPieChartProps {
  tasks: Task[];
}

const statusConfig: Record<TaskStatus, { name: string; color: string }> = {
    not_started: { name: 'Not Started', color: '#64748b' }, // slate-500
    in_progress: { name: 'In Progress', color: '#f59e0b' }, // amber-500
    completed: { name: 'Completed', color: '#16a34a' },   // green-600
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, payload }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05 || payload.value === 0) return null;

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-bold">
      {`${payload.value} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};


export default function TaskStatusPieChart({ tasks }: TaskStatusPieChartProps) {
    const chartData = useMemo(() => {
        const counts: Record<TaskStatus, number> = {
            not_started: 0,
            in_progress: 0,
            completed: 0,
        };

        tasks.forEach(task => {
            counts[task.status]++;
        });

        return Object.entries(counts).map(([status, count]) => ({
            name: statusConfig[status as TaskStatus].name,
            value: count,
            color: statusConfig[status as TaskStatus].color,
        }));
    }, [tasks]);

    const totalTasks = tasks.length;

    if (totalTasks === 0) {
        return <div className="flex items-center justify-center h-[300px] text-muted-foreground">No task data for this period.</div>
    }

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
            outerRadius={110}
            fill="#8884d8"
            dataKey="value"
            stroke="hsl(var(--background))"
            strokeWidth={3}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
           <Tooltip
                cursor={{ fill: 'hsla(var(--muted), 0.5)' }}
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
