'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { getUsers, getAttendanceForUser } from '@/lib/supabase/api';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Skeleton } from '../ui/skeleton';
import { differenceInSeconds, eachDayOfInterval, format } from 'date-fns';
import type { Attendance, AttendanceStatus, User } from '@/lib/supabase/types';
import { CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Filter } from 'lucide-react';

interface AllEmployeesDailyHoursChartProps {
  dateRange: { from: Date; to: Date };
}

type StatusFilter = 'present' | 'day_off' | 'absent';

const calculateHoursByDayForMultipleUsers = (
    attendance: Attendance[], 
    users: User[], 
    dateRange: { from: Date, to: Date },
    statusFilter: StatusFilter[]
) => {
    const dailyData: { [day: string]: { name: string; [userName: string]: number } } = {};
    const userMap = new Map(users.map(u => [u.id, u.name]));
    
    // Initialize all days of the month to ensure order and completeness
    const daysInMonth = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    for (const day of daysInMonth) {
        const dayStr = format(day, 'dd');
        dailyData[dayStr] = { name: dayStr };
    }

    const userHours: { [userId: string]: { [day: string]: number } } = {};
    users.forEach(u => userHours[u.id] = {});

    for (const record of attendance) {
        const dayStr = format(new Date(record.time), 'dd');
        const userId = record.user_id;

        if (!userHours[userId]) userHours[userId] = {};
        if (!userHours[userId][dayStr]) userHours[userId][dayStr] = 0;
    }
    
    for (const userId of Object.keys(userHours)) {
        let clockInTime: Date | null = null;
        const userAttendance = attendance
            .filter(a => a.user_id === userId)
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        
        for (const record of userAttendance) {
            const dayStr = format(new Date(record.time), 'dd');

            if (statusFilter.includes('day_off') && record.status === 'day_off' && record.paid_hours) {
                userHours[userId][dayStr] = (userHours[userId][dayStr] || 0) + record.paid_hours;
            } else if (statusFilter.includes('present') && record.status === 'present') {
                if (record.action === 'in' && !clockInTime) {
                    clockInTime = new Date(record.time);
                } else if (record.action === 'out' && clockInTime) {
                    const clockOutTime = new Date(record.time);
                    if (format(clockInTime, 'dd') === dayStr) {
                         const diffSeconds = differenceInSeconds(clockOutTime, clockInTime);
                         userHours[userId][dayStr] = (userHours[userId][dayStr] || 0) + diffSeconds / 3600;
                    }
                    clockInTime = null; 
                }
            } else if (statusFilter.includes('absent') && record.status === 'absent') {
                 if (!userHours[userId][dayStr]) userHours[userId][dayStr] = 0;
            }
        }
    }
    
    Object.keys(userHours).forEach(userId => {
        const userName = userMap.get(userId);
        if (!userName) return;

        Object.keys(userHours[userId]).forEach(dayStr => {
            if (dailyData[dayStr]) {
                dailyData[dayStr][userName] = parseFloat(userHours[userId][dayStr].toFixed(2));
            }
        });
    });

    return Object.values(dailyData).sort((a, b) => parseInt(a.name) - parseInt(b.name));
};

const USER_COLORS = [
  '#16a34a', '#2563eb', '#f97316', '#9333ea', '#facc15', 
  '#dc2626', '#14b8a6', '#ec4899', '#65a30d', '#0891b2'
];

const statusOptions: {id: StatusFilter, label: string}[] = [
    { id: 'present', label: 'Worked Days' },
    { id: 'day_off', label: 'Days-Off' },
    { id: 'absent', label: 'Absent Days' },
];

export default function AllEmployeesDailyHoursChart({ dateRange }: AllEmployeesDailyHoursChartProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter[]>(['present', 'day_off']);
  const { data: users, isLoading: isLoadingUsers } = useSWR('users', getUsers);
  const { data: allAttendance, isLoading: isLoadingAttendance } = useSWR(
    ['allAttendance', dateRange.from, dateRange.to],
    () => getAttendanceForUser(null, dateRange.from, dateRange.to)
  );


  const { chartData, userKeys } = useMemo(() => {
    if (!users || !allAttendance || allAttendance.length === 0) return { chartData: [], userKeys: [] };

    const data = calculateHoursByDayForMultipleUsers(allAttendance, users, dateRange, statusFilter);
    const keys = users.map(u => u.name).filter(name => data.some(d => d[name] > 0));
    
    return { chartData: data, userKeys: keys };
  }, [users, allAttendance, dateRange, statusFilter]);
  
  const handleFilterChange = (status: StatusFilter) => {
    setStatusFilter(prev => 
        prev.includes(status) 
            ? prev.filter(s => s !== status) 
            : [...prev, status]
    );
  };

  const isLoading = isLoadingUsers || isLoadingAttendance;
  
  const monthName = format(dateRange.from, 'MMMM yyyy');

  return (
    <>
      <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <CardTitle>All Employees Daily Hours</CardTitle>
              <CardDescription>Hours by each employee daily in {monthName}</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Show Hours For</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {statusOptions.map(option => (
                    <DropdownMenuCheckboxItem
                        key={option.id}
                        checked={statusFilter.includes(option.id)}
                        onCheckedChange={() => handleFilterChange(option.id)}
                        onSelect={(e) => e.preventDefault()}
                    >
                       {option.label}
                    </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </CardHeader>
      
      {isLoading ? (
        <Skeleton className="h-[350px] w-full" />
      ) : chartData.length === 0 || userKeys.length === 0 ? (
        <div className="flex items-center justify-center h-[350px] w-full">
            <p className="text-muted-foreground">No data to display for this period and filter.</p>
        </div>
      ) : (
        <div className="h-[350px] w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
              />
              <Legend iconType="circle" />
              {userKeys.map((key, index) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={USER_COLORS[index % USER_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}
