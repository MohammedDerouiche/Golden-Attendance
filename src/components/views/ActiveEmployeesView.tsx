
'use client';

import useSWR, { mutate } from 'swr';
import { getActiveEmployees, createAttendance } from '@/lib/supabase/api';
import AdminGuard from '../AdminGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { formatDistanceToNow, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isFriday, differenceInSeconds } from 'date-fns';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Activity, MapPin, Clock, User, DollarSign, LogOut } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useEffect, useState, useMemo } from 'react';
import type { ActiveEmployee, User as UserType } from '@/lib/supabase/types';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


const calculateMonthlyTargetHours = (user: UserType, date: Date = new Date()): number => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
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

const ActiveEmployeeCard = ({ employee, user, onClockOut }: { employee: ActiveEmployee, user: UserType | undefined, onClockOut: (employee: ActiveEmployee) => void }) => {
    const [duration, setDuration] = useState('');
    const [earnings, setEarnings] = useState(0);
    const [isClockingOut, setIsClockingOut] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const clockInTime = parseISO(employee.clock_in_time);
        
        const updateDurationAndEarnings = () => {
            const now = new Date();
            setDuration(formatDistanceToNow(clockInTime));

            if (user?.monthly_salary) {
                const monthlyTarget = calculateMonthlyTargetHours(user);
                if (monthlyTarget > 0) {
                    const effectiveHourlyRate = user.monthly_salary / monthlyTarget;
                    const secondsWorked = differenceInSeconds(now, clockInTime);
                    const hoursWorked = secondsWorked / 3600;
                    setEarnings(hoursWorked * effectiveHourlyRate);
                }
            }
        };

        updateDurationAndEarnings();
        const intervalId = setInterval(updateDurationAndEarnings, 1000); 

        return () => clearInterval(intervalId);
    }, [employee.clock_in_time, user]);

    const handleViewOnMap = () => {
        if (employee.latitude && employee.longitude) {
            const url = `https://www.google.com/maps/search/?api=1&query=${employee.latitude},${employee.longitude}`;
            window.open(url, '_blank');
        }
    };
    
    const handleClockOut = async () => {
        if (!user) return;
        setIsClockingOut(true);
        setShowConfirmation(false);
        try {
            await createAttendance({
                user_id: user.id,
                action: 'out',
                time: new Date().toISOString(),
                status: 'present',
                notes: 'Clocked out by admin'
            });
            toast({
                title: 'Success',
                description: `${employee.name} has been clocked out.`
            });
            onClockOut(employee);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to clock out ${employee.name}.`
            });
        } finally {
            setIsClockingOut(false);
        }
    }

    return (
        <>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">{employee.name}</CardTitle>
                <Avatar className="h-8 w-8">
                    <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                </Avatar>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Clocked in at {parseISO(employee.clock_in_time).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        <span>Duration: {duration}</span>
                    </div>
                     {user?.monthly_salary && (
                        <div className="flex items-center gap-2 font-medium text-primary/90">
                           <DollarSign className="h-4 w-4" />
                           <span>Today's Earnings: ${earnings.toFixed(2)}</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    {employee.latitude && employee.longitude && (
                        <Button variant="outline" size="sm" onClick={handleViewOnMap} className="w-full">
                            <MapPin className="mr-2" />
                            View Location
                        </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => setShowConfirmation(true)} disabled={isClockingOut} className="w-full">
                        <LogOut className="mr-2" />
                        {isClockingOut ? 'Clocking Out...' : 'Clock Out'}
                    </Button>
                 </div>
            </CardContent>
        </Card>
         <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will clock out {employee.name}. This action cannot be undone.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClockOut} className="bg-destructive hover:bg-destructive/90">
                    Confirm Clock Out
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
};


export default function ActiveEmployeesView() {
    const { users } = useSelectedUser();
    const { data: activeEmployees, error, isLoading, mutate: mutateActiveEmployees } = useSWR('activeEmployees', getActiveEmployees, {
        refreshInterval: 5000, 
    });

    const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
    
    const handleEmployeeClockedOut = (employee: ActiveEmployee) => {
        // Optimistically update the UI by removing the clocked-out employee
        mutateActiveEmployees((currentData) => 
            currentData?.filter(emp => emp.user_id !== employee.user_id) || [],
            false // do not revalidate yet
        );
    };

    return (
        <AdminGuard>
            <div className="container mx-auto p-4 md:p-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                    <h1 className="text-3xl font-headline font-bold text-primary">Active Employees</h1>
                    <CardDescription>A live list of employees who are currently clocked in ({activeEmployees?.length || 0} total).</CardDescription>
                </div>
                
                {isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>Failed to load data. Please try again later.</AlertDescription>
                    </Alert>
                )}

                {!isLoading && activeEmployees && activeEmployees.length > 0 && (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeEmployees.map(emp => (
                            <ActiveEmployeeCard 
                                key={emp.user_id} 
                                employee={emp} 
                                user={userMap.get(emp.user_id)} 
                                onClockOut={handleEmployeeClockedOut}
                            />
                        ))}
                    </div>
                )}
                
                {!isLoading && activeEmployees?.length === 0 && (
                    <Card className="flex flex-col items-center justify-center p-12">
                        <User className="mx-auto h-12 w-12 text-muted-foreground" />
                        <CardTitle className="mt-4">No Active Employees</CardTitle>
                        <CardDescription className="mt-2">No one is currently clocked in.</CardDescription>
                    </Card>
                )}
            </div>
        </AdminGuard>
    );
}
