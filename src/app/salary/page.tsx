'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { getAttendanceForUser, updateUser } from '@/lib/supabase/api';
import type { Attendance, User } from '@/lib/supabase/types';
import { format, differenceInSeconds } from 'date-fns';
import { Calendar as CalendarIcon, DollarSign, Save, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { DateRange } from 'react-day-picker';
import { exportToExcel, generateFileName } from '@/lib/utils';

const calculateTotalHours = (attendance: Attendance[]) => {
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


export default function SalaryPage() {
    const { selectedUser: currentUser, users, isLoading: isUserLoading, mutateUsers } = useSelectedUser();
    const { toast } = useToast();
    
    const [targetUserId, setTargetUserId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [hourlyRate, setHourlyRate] = useState<number | string>('');
    const [isCalculating, setIsCalculating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [results, setResults] = useState<{ totalHours: number; salary: number } | null>(null);

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
            setHourlyRate(targetUser.hourly_rate || '');
            setResults(null);
        }
    }, [targetUser]);
    
    const handleCalculate = async () => {
        if (!targetUserId || !dateRange?.from || !hourlyRate) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please select a user, date range, and enter an hourly rate.',
            });
            return;
        }

        setIsCalculating(true);
        setResults(null);
        try {
            const attendance = await getAttendanceForUser(targetUserId, dateRange.from, dateRange.to);
            const totalHours = calculateTotalHours(attendance);
            const salary = totalHours * Number(hourlyRate);
            setResults({ totalHours, salary });

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
    
    const handleSaveRate = async () => {
        if (!targetUser || hourlyRate === '' || currentUser?.role !== 'admin') return;

        setIsSaving(true);
        try {
            await updateUser(targetUser.id, { hourly_rate: Number(hourlyRate) });
            await mutateUsers();
            toast({
                title: 'Rate Saved',
                description: `Hourly rate for ${targetUser.name} has been updated.`,
            });
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Error Saving Rate',
                description: error.message,
            });
        } finally {
            setIsSaving(false);
        }
    }

    const handleExport = () => {
        if (!results || !targetUser || !dateRange) {
            toast({
                variant: 'destructive',
                title: 'No Data to Export',
                description: 'Please calculate the salary first before exporting.',
            });
            return;
        }

        const dataToExport = [
            {
                'Metric': 'User',
                'Value': targetUser.name,
            },
            {
                'Metric': 'Date Range',
                'Value': `${format(dateRange.from!, 'PPP')} - ${format(dateRange.to!, 'PPP')}`,
            },
            {
                'Metric': 'Hourly Rate',
                'Value': `$${Number(hourlyRate).toFixed(2)}`,
            },
            {
                'Metric': 'Total Paid Hours',
                'Value': results.totalHours.toFixed(2),
            },
            {
                'Metric': 'Calculated Salary',
                'Value': `$${results.salary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
        ];
        
        const fileName = generateFileName('Salary', targetUser.name, dateRange);

        exportToExcel(dataToExport, fileName);
    };


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
                <p className="text-muted-foreground">Please select a user to calculate salary.</p>
              </CardContent>
            </Card>
           </div>
        );
    }

    const selectableUsers = currentUser.role === 'admin' ? users : [currentUser];

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-headline font-bold mb-6 text-primary">Salary Calculator</h1>
            <Card className="max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>Select a user, date range, and hourly rate to calculate the salary.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                            <Label htmlFor="date-range">Date Range</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    id="date-range"
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                        {format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
                                        </>
                                    ) : (
                                        format(dateRange.from, 'LLL dd, y')
                                    )
                                    ) : (
                                    <span>Pick a date range</span>
                                    )}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="hourly-rate">Hourly Rate ($)</Label>
                        <div className="flex items-center gap-2">
                             <Input 
                                id="hourly-rate" 
                                type="number" 
                                placeholder="e.g. 25.50"
                                value={hourlyRate}
                                onChange={(e) => setHourlyRate(e.target.value)}
                                className="max-w-xs"
                            />
                            {currentUser.role === 'admin' && (
                                <Button onClick={handleSaveRate} disabled={isSaving}>
                                    <Save className="mr-2 h-4 w-4" />
                                    {isSaving ? 'Saving...' : 'Save Rate'}
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button onClick={handleCalculate} disabled={isCalculating} size="lg" className="flex-grow">
                            <DollarSign className="mr-2 h-5 w-5" />
                            {isCalculating ? 'Calculating...' : 'Calculate Salary'}
                        </Button>
                         <Button variant="outline" onClick={handleExport} disabled={!results} size="lg">
                            <FileDown className="mr-2 h-5 w-5" />
                            Export
                        </Button>
                    </div>

                    {isCalculating && (
                        <div className="space-y-4 pt-4">
                            <Skeleton className="h-8 w-1/2 mx-auto" />
                            <Skeleton className="h-16 w-3/4 mx-auto" />
                        </div>
                    )}

                    {results && (
                        <Card className="bg-primary/5 border-primary/20 text-center animate-fade-in">
                            <CardHeader>
                                <CardTitle className="text-primary">Calculation Results</CardTitle>
                                <CardDescription>For {targetUser?.name} between {format(dateRange!.from!, 'PPP')} and {format(dateRange!.to!, 'PPP')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Paid Hours</p>
                                    <p className="text-3xl font-bold">{results.totalHours.toFixed(2)} hours</p>
                                </div>
                                 <div>
                                    <p className="text-sm text-muted-foreground">Calculated Salary</p>
                                    <p className="text-4xl font-bold text-accent">
                                        ${results.salary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                </CardContent>
            </Card>
        </div>
    );
}
