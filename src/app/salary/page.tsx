
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { getAttendanceForUser, getTasks, updateUser, getPenaltySettings } from '@/lib/supabase/api';
import type { Attendance, User, Task, TaskPriority, PenaltySetting } from '@/lib/supabase/types';
import { format, differenceInSeconds, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isFriday, isPast, isToday } from 'date-fns';
import { Calendar as CalendarIcon, DollarSign, Save, FileDown, Target, Hourglass, AlertTriangle, Briefcase, Check, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { DateRange } from 'react-day-picker';
import { exportToExcel, generateFileName } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const calculateTotalHoursFromAttendance = (attendance: Attendance[]) => {
    let totalSeconds = 0;
    const sortedAttendance = [...attendance].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    let clockInTime: Date | null = null;

    for (const record of sortedAttendance) {
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
    return totalSeconds / 3600;
};

const calculateHoursByDay = (attendance: Attendance[]): { [key: string]: number } => {
    const dailyHours: { [key: string]: number } = {};
    if (!attendance) return dailyHours;

    const sorted = [...attendance].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    sorted.forEach(record => {
        const day = format(new Date(record.time), 'yyyy-MM-dd');
        if (!dailyHours[day]) {
            dailyHours[day] = 0;
        }
    });

    let clockInTime: Date | null = null;
    for (const record of sorted) {
        const day = format(new Date(record.time), 'yyyy-MM-dd');
        if (record.status === 'day_off' && record.paid_hours) {
            dailyHours[day] += record.paid_hours;
        } else if (record.status === 'present') {
            if (record.action === 'in' && !clockInTime) {
                clockInTime = new Date(record.time);
            } else if (record.action === 'out' && clockInTime) {
                const clockOutTime = new Date(record.time);
                const clockInDay = format(clockInTime, 'yyyy-MM-dd');
                // Ensure the clock-in belongs to the same day before calculating
                if (clockInDay === day) {
                    const diffSeconds = (clockOutTime.getTime() - clockInTime.getTime()) / 1000;
                    dailyHours[day] += diffSeconds / 3600;
                }
                clockInTime = null;
            }
        }
    }
    return dailyHours;
}

const calculateMonthlyTargetHours = (user: User, month: Date): number => {
    if (!user) return 0;
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    let fridays = 0;
    
    daysInMonth.forEach(day => {
        if (isFriday(day)) {
            fridays++;
        }
    });
    
    const otherDays = daysInMonth.length - fridays;

    const fridayTarget = user.friday_target_hours ?? user.daily_target_hours;
    const targetHours = (otherDays * user.daily_target_hours) + (fridays * fridayTarget);
    
    return targetHours;
}

const calculatePenalties = (tasks: Task[], range: DateRange, penaltySettings: Record<TaskPriority, number>): { total: number, daily: {[key: string]: number} } => {
    let totalPenalty = 0;
    const dailyPenalties: {[key: string]: number} = {};
    if (!tasks || !range.from || !penaltySettings) return { total: 0, daily: {} };
    
    const overdueTasks = tasks.filter(task => 
        task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed'
    );
    
    overdueTasks.forEach(task => {
        const penalty = penaltySettings[task.priority] || 0;
        totalPenalty += penalty;
        const dueDateStr = format(new Date(task.due_date!), 'yyyy-MM-dd');
        dailyPenalties[dueDateStr] = (dailyPenalties[dueDateStr] || 0) + penalty;
    });

    return { total: totalPenalty, daily: dailyPenalties };
};


export default function SalaryPage() {
    const { selectedUser: currentUser, users, isLoading: isUserLoading, mutateUsers } = useSelectedUser();
    const { toast } = useToast();
    
    const [targetUserId, setTargetUserId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [monthlySalary, setMonthlySalary] = useState<number | string>('');
    const [isCalculating, setIsCalculating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const { data: penaltySettingsData, isLoading: isLoadingPenalties } = useSWR('penalty_settings', getPenaltySettings);

    const penaltySettings = useMemo(() => {
        if (!penaltySettingsData) return null;
        return penaltySettingsData.reduce((acc, setting) => {
            acc[setting.priority as TaskPriority] = setting.amount;
            return acc;
        }, {} as Record<TaskPriority, number>);
    }, [penaltySettingsData]);


    const [results, setResults] = useState<{ 
        totalHours: number;
        grossSalary: number;
        totalPenalties: number;
        netSalary: number;
        targetHours: number;
        effectiveHourlyRate: number;
        attendance: Attendance[];
        tasks: Task[];
    } | null>(null);

    const targetUser = useMemo(() => {
        if (!targetUserId) return null;
        return users.find(u => u.id === targetUserId);
    }, [targetUserId, users]);

    useEffect(() => {
        if(currentUser) {
            setTargetUserId(currentUser.id);
        }
    }, [currentUser]);

    useEffect(() => {
        if (targetUser) {
            setMonthlySalary(targetUser.monthly_salary || '');
            setResults(null);
            setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
        }
    }, [targetUser]);
    
    const handleCalculate = async () => {
        if (!targetUser || !dateRange?.from || !monthlySalary || !penaltySettings) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please select a user, date range, and ensure salary and penalty settings are loaded.',
            });
            return;
        }

        setIsCalculating(true);
        setResults(null);
        try {
            const targetHours = calculateMonthlyTargetHours(targetUser, dateRange.from);

            if (targetHours === 0) {
                 toast({
                    variant: 'destructive',
                    title: 'Calculation Error',
                    description: 'Monthly target hours are zero. Cannot calculate salary.',
                });
                setIsCalculating(false);
                return;
            }

            const [attendance, tasks] = await Promise.all([
                getAttendanceForUser(targetUser.id, dateRange.from, dateRange.to),
                getTasks(targetUser.id, false, {}, dateRange)
            ]);
            
            const totalHours = calculateTotalHoursFromAttendance(attendance);
            const { total: totalPenalties } = calculatePenalties(tasks, dateRange, penaltySettings);

            const effectiveHourlyRate = Number(monthlySalary) / targetHours;
            const grossSalary = totalHours * effectiveHourlyRate;
            const netSalary = grossSalary - totalPenalties;
            
            setResults({ totalHours, grossSalary, totalPenalties, netSalary, targetHours, effectiveHourlyRate, attendance, tasks });

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Calculation Error',
                description: error.message,
            });
        } finally {
            setIsCalculating(false);
        }
    };
    
    const handleSaveSalary = async () => {
        if (!targetUser || monthlySalary === '' || currentUser?.role !== 'admin') return;

        setIsSaving(true);
        try {
            await updateUser(targetUser.id, { monthly_salary: Number(monthlySalary) });
            await mutateUsers();
            toast({
                title: 'Salary Saved',
                description: `Monthly salary for ${targetUser.name} has been updated.`,
            });
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Error Saving Salary',
                description: error.message,
            });
        } finally {
            setIsSaving(false);
        }
    }

    const handleExport = () => {
        if (!results || !targetUser || !dateRange?.from || !penaltySettings) {
            toast({
                variant: 'destructive',
                title: 'No Data to Export',
                description: 'Please calculate the salary first before exporting.',
            });
            return;
        }

        const dailyHours = calculateHoursByDay(results.attendance);
        const { daily: dailyPenalties } = calculatePenalties(results.tasks, dateRange, penaltySettings);
        const daysOfMonth = eachDayOfInterval({ start: dateRange.from, end: dateRange.to || dateRange.from });
        
        const dailyData = daysOfMonth.map(day => {
            const dayString = format(day, 'yyyy-MM-dd');
            const hoursWorked = dailyHours[dayString] || 0;
            const daySalary = hoursWorked * results.effectiveHourlyRate;
            const dayPenalty = dailyPenalties[dayString] || 0;
            return {
                'Date': format(day, 'PPP'),
                'Day': format(day, 'eeee'),
                'Hours Worked': hoursWorked.toFixed(2),
                'Daily Gross Salary': daySalary.toFixed(2),
                'Daily Penalties': dayPenalty > 0 ? `-$${dayPenalty.toFixed(2)}` : '$0.00',
                'Daily Net': (daySalary - dayPenalty).toFixed(2),
            };
        });

        const summaryData = [
            {}, // Spacer row
            { 'Date': '--- SUMMARY ---' },
            { 'Date': 'User', 'Day': targetUser.name },
            { 'Date': 'Month', 'Day': format(dateRange.from, 'MMMM yyyy') },
            { 'Date': 'Configured Monthly Salary', 'Day': `$${Number(monthlySalary).toFixed(2)}` },
            { 'Date': 'Target Hours for Month', 'Day': results.targetHours.toFixed(2) },
            { 'Date': 'Effective Hourly Rate', 'Day': `$${results.effectiveHourlyRate.toFixed(2)}` },
            { 'Date': 'Total Paid Hours', 'Day': results.totalHours.toFixed(2) },
            { 'Date': 'Gross Salary (from hours)', 'Day': `$${results.grossSalary.toFixed(2)}` },
            { 'Date': 'Total Penalties', 'Day': `-$${results.totalPenalties.toFixed(2)}`},
            { 'Date': 'FINAL NET SALARY', 'Day': `$${results.netSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`},
        ];

        const dataToExport = [...dailyData, ...summaryData];
        const fileName = generateFileName('Salary_Report', targetUser.name, dateRange);
        exportToExcel(dataToExport, fileName);
    };


    if (isUserLoading || isLoadingPenalties) {
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
                <p className="text-muted-foreground">Please select a user to calculate salary.</p>
              </CardContent>
            </Card>
           </div>
        );
    }

    const selectableUsers = currentUser.role === 'admin' ? users : [currentUser];

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-2xl md:text-3xl font-headline font-bold mb-6 text-primary">Salary Calculator</h1>
            <div className="flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Configuration</CardTitle>
                        <CardDescription>Select a user and month to calculate their salary.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                           <Label htmlFor="user-select">User</Label>
                           <Select onValueChange={setTargetUserId} value={targetUserId || ''} disabled={currentUser.role !== 'admin'}>
                               <SelectTrigger id="user-select">
                                   <SelectValue placeholder="Select a user" />
                               </SelectTrigger>
                               <SelectContent>
                                   {selectableUsers.map((user) => (
                                       <SelectItem key={user.id} value={user.id}>
                                           {user.name} ({user.role})
                                       </SelectItem>
                                   ))}
                               </SelectContent>
                           </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="date-range">Month</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    id="date-range"
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? format(dateRange.from, 'MMMM, yyyy') : <span>Pick a month</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="single"
                                    selected={dateRange?.from}
                                    onSelect={(day) => day && setDateRange({ from: startOfMonth(day), to: endOfMonth(day)})}
                                    numberOfMonths={1}
                                />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="monthly-salary">Monthly Salary ($)</Label>
                            <div className="flex items-center gap-2">
                                <Input 
                                    id="monthly-salary" 
                                    type="number" 
                                    placeholder="e.g. 5000"
                                    value={monthlySalary}
                                    onChange={(e) => setMonthlySalary(e.target.value)}
                                    className="max-w-xs"
                                />
                                {currentUser.role === 'admin' && (
                                    <Button onClick={handleSaveSalary} disabled={isSaving}>
                                        <Save className="mr-2 h-4 w-4" />
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button onClick={handleCalculate} disabled={isCalculating || isLoadingPenalties} size="lg">
                                <DollarSign className="mr-2 h-5 w-5" />
                                {isCalculating ? 'Calculating...' : 'Calculate Salary'}
                            </Button>
                            <Button variant="outline" onClick={handleExport} disabled={!results}>
                                <FileDown className="mr-2 h-5 w-5" />
                                Export Detailed Report
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                
                {isCalculating && (
                    <Card>
                         <CardContent className="pt-6 space-y-4">
                            <Skeleton className="h-8 w-1/2 mx-auto" />
                            <Skeleton className="h-24 w-full" />
                        </CardContent>
                    </Card>
                )}

                {results && targetUser && dateRange?.from && (
                    <Card className="bg-primary/5 border-primary/20 animate-fade-in">
                        <CardHeader>
                            <CardTitle className="text-primary">Calculation Results</CardTitle>
                            <CardDescription>{`For ${targetUser.name} in ${format(dateRange.from, 'MMMM yyyy')}`}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
                                <div className="space-y-4">
                                     <div className="bg-background/50 p-4 rounded-lg">
                                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2"><Target className="h-4 w-4" /> Target Hours</p>
                                        <p className="text-2xl font-bold">{results.targetHours.toFixed(2)}h</p>
                                    </div>
                                    <div className="bg-background/50 p-4 rounded-lg">
                                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2"><Briefcase className="h-4 w-4" /> Hours Worked</p>
                                        <p className="text-2xl font-bold">{results.totalHours.toFixed(2)}h</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-background/50 p-4 rounded-lg">
                                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2"><Hourglass className="h-4 w-4" /> Gross Salary (from hours)</p>
                                        <p className="text-2xl font-bold text-green-600">${results.grossSalary.toFixed(2)}</p>
                                    </div>
                                    <div className="bg-background/50 p-4 rounded-lg">
                                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2"><AlertTriangle className="h-4 w-4" /> Task Penalties</p>
                                        <p className="text-2xl font-bold text-destructive">-${results.totalPenalties.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-center pt-6 border-t">
                                <p className="text-base text-muted-foreground">Final Net Salary</p>
                                 <p className="text-5xl font-bold text-primary">
                                    ${results.netSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                {results.totalHours < results.targetHours && (
                                    <Badge variant="secondary" className="mt-2 flex items-center justify-center gap-2 max-w-fit mx-auto">
                                        <Info className="h-3 w-3" />
                                        Salary is pro-rated based on hours worked
                                    </Badge>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
