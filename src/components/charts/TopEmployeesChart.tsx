
'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { getUsers, getAttendanceForUser } from '@/lib/supabase/api';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts';
import { Skeleton } from '../ui/skeleton';
import { differenceInSeconds } from 'date-fns';
import type { Attendance, User } from '@/lib/supabase/types';

interface TopEmployeesChartProps {
  dateRange: { from: Date; to: Date };
}

const calculateTotalHours = (attendance: Attendance[]) => {
    const userHours: { [key: string]: number } = {};

    attendance.forEach(record => {
        if (!userHours[record.user_id]) {
            userHours[record.user_id] = 0;
        }
    });

    for (const userId in userHours) {
        let totalSeconds = 0;
        const userAttendance = attendance
            .filter(a => a.user_id === userId)
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        let clockInTime: Date | null = null;
        for (const record of userAttendance) {
             if (record.status === 'day_off' && record.paid_hours) {
                totalSeconds += record.paid_hours * 3600;
            } else if (record.status === 'present') {
                if (record.action === 'in' && !clockInTime) {
                    clockInTime = new Date(record.time);
                } else if (record.action === 'out' && clockInTime) {
                    const clockOutTime = new Date(record.time);
                    totalSeconds += differenceInSeconds(clockOutTime, clockInTime);
                    clockInTime = null; 
                }
            }
        }
        userHours[userId] = totalSeconds / 3600;
    }
    return userHours;
};


export default function TopEmployeesChart({ dateRange }: TopEmployeesChartProps) {
  const { data: users, isLoading: isLoadingUsers } = useSWR('users', getUsers);
  const { data: allAttendance, isLoading: isLoadingAttendance } = useSWR(
    ['allAttendance', dateRange.from, dateRange.to],
    () => getAttendanceForUser(null, dateRange.from, dateRange.to)
  );


  const chartData = useMemo(() => {
    if (!users || !allAttendance) return [];
    
    const userHours = calculateTotalHours(allAttendance);

    return users
      .map(user => ({
        name: user.name.split(' ')[0], // Use first name
        hours: parseFloat((userHours[user.id] || 0).toFixed(2)),
      }))
      .filter(data => data.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  }, [users, allAttendance]);

  const isLoading = isLoadingUsers || isLoadingAttendance;

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if(chartData.length === 0) {
    return (
        <div className="flex items-center justify-center h-[300px] w-full">
            <p className="text-muted-foreground">No data to display for this period.</p>
        </div>
    )
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="hsl(var(--muted-foreground))" 
            fontSize={12} 
            width={60} 
            tickLine={false} 
            axisLine={false}
          />
          <Tooltip
             cursor={false}
             contentStyle={{
                background: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
            }}
             formatter={(value) => [`${value} hours`, 'Total Hours']}
          />
          <Bar dataKey="hours" fill="#16a34a" radius={[0, 4, 4, 0]} barSize={25}>
             <LabelList dataKey="hours" position="right" offset={10} className="fill-foreground font-medium" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

