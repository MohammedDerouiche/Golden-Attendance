'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getAttendanceForUser, getTasks } from '@/lib/supabase/api';
import type { Attendance, Task, User } from '@/lib/supabase/types';
import { subMonths, startOfMonth, endOfMonth, format, getDaysInMonth, eachDayOfInterval } from 'date-fns';
import MonthlyHoursChart from '@/components/charts/MonthlyHoursChart';
import TopEmployeesChart from '@/components/charts/TopEmployeesChart';
import AttendanceHeatmap from '@/components/charts/AttendanceHeatmap';
import TaskStatusPieChart from '@/components/charts/TaskStatusPieChart';
import AllEmployeesDailyHoursChart from '@/components/charts/AllEmployeesDailyHoursChart';
import { Check, X, CalendarOff, Clock } from 'lucide-react';

// Helper function to calculate total hours from attendance records
const calculateHoursByDay = (attendance: Attendance[]) => {
  const dailyHours: { [key: string]: number } = {};
  
  if (!attendance) return dailyHours;

  const sorted = [...attendance].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  let clockInTime: Date | null = null;
  for (const record of sorted) {
    const day = format(new Date(record.time), 'yyyy-MM-dd');
    if (record.status === 'day_off' && record.paid_hours) {
        if (!dailyHours[day]) dailyHours[day] = 0;
        dailyHours[day] += record.paid_hours;
    } else if (record.status === 'present') {
        if (record.action === 'in' && !clockInTime) {
            clockInTime = new Date(record.time);
        } else if (record.action === 'out' && clockInTime) {
            const clockOutTime = new Date(record.time);
            const diffSeconds = (clockOutTime.getTime() - clockInTime.getTime()) / 1000;
            if (!dailyHours[day]) dailyHours[day] = 0;
            dailyHours[day] += diffSeconds / 3600;
            clockInTime = null;
        }
    }
  }
  return dailyHours;
};

// Helper function to process attendance data for the heatmap
const processAttendanceForHeatmap = (attendance: Attendance[], month: Date) => {
    const dailyStatus: { [key: string]: { status: 'worked' | 'day_off' | 'absent' } } = {};
    if (!attendance) return dailyStatus;

    for (const record of attendance) {
        const day = format(new Date(record.time), 'yyyy-MM-dd');
        if (record.status === 'day_off') {
            dailyStatus[day] = { status: 'day_off' };
        } else if (record.status === 'absent') {
            dailyStatus[day] = { status: 'absent' };
        } else if (record.status === 'present' && !dailyStatus[day]) {
            dailyStatus[day] = { status: 'worked' };
        }
    }
    return dailyStatus;
}


export default function StatisticsPage() {
  const { selectedUser: currentUser, users, isLoading: isUserLoading } = useSelectedUser();
  const [monthOffset, setMonthOffset] = useState(0);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const targetDate = subMonths(new Date(), monthOffset);
  const dateRange = {
    from: startOfMonth(targetDate),
    to: endOfMonth(targetDate),
  };

  const targetUserId = currentUser?.role === 'admin' ? (viewingUserId || currentUser.id) : currentUser?.id;
  
  const { data: attendance, isLoading: isAttendanceLoading } = useSWR(
    targetUserId ? ['attendance', targetUserId, dateRange.from, dateRange.to] : null,
    () => getAttendanceForUser(targetUserId!, dateRange.from, dateRange.to)
  );

  const { data: tasks, isLoading: isTasksLoading } = useSWR(
    targetUserId ? ['tasks', targetUserId, currentUser?.role, dateRange] : null,
    () => getTasks(targetUserId!, currentUser!.role === 'admin', {}, dateRange)
  );

  const dailyHours = useMemo(() => {
    if (!attendance) return {};
    return calculateHoursByDay(attendance);
  }, [attendance]);

  const heatmapData = useMemo(() => {
    if (!attendance) return {};
    return processAttendanceForHeatmap(attendance, dateRange.from);
  }, [attendance, dateRange.from]);

  const monthlyChartData = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];
    const daysInMonth = eachDayOfInterval({start: dateRange.from, end: dateRange.to});
    
    return daysInMonth.map((day) => {
      const formattedDayKey = format(day, 'yyyy-MM-dd');
      const hours = dailyHours[formattedDayKey] || 0;
      const status = heatmapData[formattedDayKey]?.status || (hours > 0 ? 'absent' : 'absent');
      return {
        name: format(day, 'dd'),
        hours: parseFloat(hours.toFixed(2)),
        status: status,
      };
    });
  }, [dailyHours, heatmapData, dateRange]);

  const attendanceSummary = useMemo(() => {
    const summary = {
        worked: 0,
        day_off: 0,
        absent: 0,
    };
    Object.values(heatmapData).forEach(value => {
        summary[value.status]++;
    });
    return summary;
  }, [heatmapData]);

  const averageHoursPerWorkedDay = useMemo(() => {
    if (attendanceSummary.worked === 0) return 0;
    
    const totalWorkedHours = Object.entries(dailyHours)
        .filter(([day]) => heatmapData[day]?.status === 'worked')
        .reduce((acc, [, hours]) => acc + hours, 0);

    return totalWorkedHours / attendanceSummary.worked;
  }, [dailyHours, heatmapData, attendanceSummary.worked]);


  if (isUserLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <Skeleton className="h-10 w-1/4 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex-grow flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please select a user to view statistics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = isUserLoading || isAttendanceLoading || isTasksLoading;
  const monthName = format(dateRange.from, 'MMMM yyyy');

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-headline font-bold text-primary">Statistics</h1>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
             {currentUser.role === 'admin' && (
                 <div className="space-y-1.5 flex-1">
                    <Label htmlFor="user-select">Viewing For</Label>
                    <Select onValueChange={setViewingUserId} defaultValue={currentUser.id}>
                        <SelectTrigger id="user-select">
                            <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                        {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                 </div>
             )}
             <div className="space-y-1.5 flex-1">
                 <Label htmlFor="month-select">Month</Label>
                 <Select onValueChange={(val) => setMonthOffset(Number(val))} defaultValue="0">
                     <SelectTrigger id="month-select">
                         <SelectValue placeholder="Select month" />
                     </SelectTrigger>
                     <SelectContent>
                        {Array.from({length: 12}).map((_, i) => (
                            <SelectItem key={i} value={String(i)}>{format(subMonths(new Date(), i), 'MMMM yyyy')}</SelectItem>
                        ))}
                     </SelectContent>
                 </Select>
             </div>
          </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Monthly Summary</CardTitle>
                <CardDescription>Total counts for the selected month.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? <Skeleton className="h-24 w-full" /> : (
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="flex items-center text-green-600"><Check className="mr-2 h-4 w-4" /> Worked Days</span>
                            <span className="font-bold">{attendanceSummary.worked}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="flex items-center text-yellow-600"><CalendarOff className="mr-2 h-4 w-4" /> Days-Off</span>
                            <span className="font-bold">{attendanceSummary.day_off}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="flex items-center text-red-600"><X className="mr-2 h-4 w-4" /> Absent Days</span>
                            <span className="font-bold">{attendanceSummary.absent}</span>
                        </div>
                        <div className="flex justify-between items-center border-t pt-2 mt-2">
                            <span className="flex items-center text-primary/80"><Clock className="mr-2 h-4 w-4" /> Avg. Work Hours</span>
                            <span className="font-bold">{averageHoursPerWorkedDay.toFixed(2)} h</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Tasks Summary</CardTitle>
                <CardDescription>Status of tasks with due dates in {monthName}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-[300px] w-full" /> : 
                  <TaskStatusPieChart tasks={tasks || []} />
                }
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Daily Hours Worked</CardTitle>
                <CardDescription>Total hours worked each day in {monthName}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-[350px] w-full" /> : 
                  monthlyChartData.some(d => d.hours > 0) ? <MonthlyHoursChart data={monthlyChartData} dateRange={dateRange} averageHours={averageHoursPerWorkedDay} /> : <div className="flex items-center justify-center h-[350px] text-muted-foreground">No data to display for this period.</div>
                }
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Attendance Calendar</CardTitle>
                <CardDescription>Status for each day in {monthName}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-[300px] w-full" /> : Object.keys(heatmapData).length > 0 ? <AttendanceHeatmap data={heatmapData} month={dateRange.from} />: <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data to display for this period.</div>}
            </CardContent>
        </Card>

         {currentUser.role === 'admin' && (
            <>
                <Card>
                    <CardHeader>
                        <CardTitle>Top Employees by Hours</CardTitle>
                        <CardDescription>Ranking of employees by total hours in {monthName}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TopEmployeesChart dateRange={dateRange} />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <AllEmployeesDailyHoursChart dateRange={dateRange} />
                    </CardContent>
                </Card>
            </>
        )}
      </div>
    </div>
  );
}
