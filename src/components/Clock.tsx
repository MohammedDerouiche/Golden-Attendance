
'use client';
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { getLastAttendanceForUser, createAttendance, getTodaysAttendanceForUser, markAsDayOff, markAsAbsent, getMonthlyAttendanceForUser } from '@/lib/supabase/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, parseISO, getDay, startOfMonth, endOfMonth, eachDayOfInterval, isSaturday, isSunday, isFriday } from 'date-fns';
import { Skeleton } from './ui/skeleton';
import { LogIn, LogOut, CheckCircle2, DollarSign, XCircle, CalendarCheck, Target, Hourglass, Calendar as CalendarIcon } from 'lucide-react';
import type { Attendance, AttendanceStatus, User } from '@/lib/supabase/types';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

const calculateWorkedHours = (attendance: Attendance[]): number => {
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
                totalSeconds += (clockOutTime.getTime() - clockInTime.getTime()) / 1000;
                clockInTime = null;
            }
        }
    }
    
    // If user is currently clocked in, add time since last clock-in
    const lastRecord = sortedAttendance[sortedAttendance.length - 1];
    if (lastRecord?.action === 'in' && lastRecord.status === 'present') {
        totalSeconds += (new Date().getTime() - new Date(lastRecord.time).getTime()) / 1000;
    }

    return totalSeconds;
};

const formatDuration = (totalSeconds: number): string => {
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const calculateMonthlyTargetHours = (user: User, date: Date = new Date()): number => {
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

export default function Clock() {
  const { selectedUser } = useSelectedUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [liveSecondsToday, setLiveSecondsToday] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState<AttendanceStatus | null>(null);

  const { data: lastAttendance, mutate: mutateLast, isLoading: isLoadingLast } = useSWR(
    selectedUser ? `last_attendance_${selectedUser.id}` : null,
    () => getLastAttendanceForUser(selectedUser!.id)
  );

  const { data: todaysAttendance, mutate: mutateToday, isLoading: isLoadingToday } = useSWR(
    selectedUser ? `todays_attendance_${selectedUser.id}` : null,
    () => getTodaysAttendanceForUser(selectedUser!.id),
    { refreshInterval: 5000 }
  );

  const { data: monthlyAttendance, mutate: mutateMonth, isLoading: isLoadingMonth } = useSWR(
      selectedUser ? `monthly_attendance_${selectedUser.id}` : null,
      () => getMonthlyAttendanceForUser(selectedUser!.id, new Date()),
      { refreshInterval: 60000 }
  );
  
  useEffect(() => {
    if (todaysAttendance) {
        const totalSeconds = calculateWorkedHours(todaysAttendance);
        setLiveSecondsToday(totalSeconds);
    }
  }, [todaysAttendance]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (lastAttendance?.action === 'in') {
      timer = setInterval(() => {
        setLiveSecondsToday(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lastAttendance]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setLocation(null)
    );
  }, []);

  const handleClockAction = async (action: 'in' | 'out') => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await createAttendance({
        user_id: selectedUser.id,
        action,
        time: new Date().toISOString(),
        latitude: location?.latitude,
        longitude: location?.longitude,
        status: 'present', // This is a regular clock in/out
      });
      await mutateLast();
      await mutateToday();
      await mutateMonth();
      toast({
        title: action === 'in' ? 'Successfully Clocked In' : 'Successfully Clocked Out',
        description: 'Your time has been recorded.',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleStaticMark = async () => {
     if (!selectedUser || !showConfirmation) return;
     setIsSubmitting(true);

     try {
        if (showConfirmation === 'day_off') {
            const isFriday = getDay(new Date()) === 5;
            const paidHours = isFriday 
                ? (selectedUser.friday_target_hours || selectedUser.daily_target_hours)
                : selectedUser.daily_target_hours;
            await markAsDayOff(selectedUser.id, paidHours);
        } else if (showConfirmation === 'absent') {
            await markAsAbsent(selectedUser.id);
        }
        await mutateLast();
        await mutateToday();
        await mutateMonth();
        toast({
            title: 'Successfully Recorded',
            description: 'Your status for today has been recorded.',
        });

     } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
     } finally {
        setIsSubmitting(false);
        setShowConfirmation(null);
     }
  }

  const hasStaticMarkToday = useMemo(() => {
    if (!todaysAttendance || todaysAttendance.length === 0) return false;
    return todaysAttendance.some(r => r.status === 'absent' || r.status === 'day_off');
  }, [todaysAttendance]);
  
  const { monthlyHoursWorked, monthlyTargetHours, monthlyProgressPercentage } = useMemo(() => {
    if (!selectedUser) return { monthlyHoursWorked: 0, monthlyTargetHours: 0, monthlyProgressPercentage: 0 };
    
    const target = calculateMonthlyTargetHours(selectedUser, new Date());
    const worked = monthlyAttendance ? calculateWorkedHours(monthlyAttendance) / 3600 : 0;
    const progress = target > 0 ? (worked / target) * 100 : 0;

    return {
      monthlyHoursWorked: worked,
      monthlyTargetHours: target,
      monthlyProgressPercentage: progress,
    };
  }, [monthlyAttendance, selectedUser]);

  const canClockIn = !hasStaticMarkToday && lastAttendance?.action !== 'in';
  const canClockOut = !hasStaticMarkToday && lastAttendance?.action === 'in';

  const dailyProgressPercentage = useMemo(() => {
    if (!selectedUser) return 0;
    const isFriday = getDay(new Date()) === 5;
    const targetHours = isFriday 
        ? (selectedUser.friday_target_hours || selectedUser.daily_target_hours) 
        : selectedUser.daily_target_hours;
    if (!targetHours) return 0;
    const currentHours = liveSecondsToday / 3600;
    return (currentHours / targetHours) * 100;
  }, [liveSecondsToday, selectedUser]);

  const todaysEarnings = useMemo(() => {
    if (!selectedUser?.monthly_salary) return null;
    const monthlyTarget = calculateMonthlyTargetHours(selectedUser);
    if (monthlyTarget === 0) return null;
    
    const effectiveHourlyRate = selectedUser.monthly_salary / monthlyTarget;
    const hoursWorked = liveSecondsToday / 3600;
    return hoursWorked * effectiveHourlyRate;
  }, [liveSecondsToday, selectedUser]);
  
  const dailyProgressColor = useMemo(() => {
    if (dailyProgressPercentage >= 100) return 'bg-green-500';
    if (dailyProgressPercentage >= 50) return 'bg-yellow-500';
    return 'bg-yellow-300';
  }, [dailyProgressPercentage]);
  
  const timeWorkedColor = useMemo(() => {
    if (!selectedUser || liveSecondsToday === 0) return 'text-muted-foreground';
    const isFriday = getDay(new Date()) === 5;
    const targetHours = isFriday 
        ? (selectedUser.friday_target_hours || selectedUser.daily_target_hours) 
        : selectedUser.daily_target_hours;

    if (!targetHours) return 'text-muted-foreground';

    const hoursWorked = liveSecondsToday / 3600;
    if (hoursWorked >= targetHours) return 'text-green-600';
    return 'text-yellow-500';
  }, [liveSecondsToday, selectedUser]);

  const getDailyStatusMessage = () => {
    if (hasStaticMarkToday) {
        const staticRecord = todaysAttendance?.find(r => r.status === 'absent' || r.status === 'day_off');
        if (staticRecord?.status === 'absent') return "You have marked today as Absent.";
        if (staticRecord?.status === 'day_off') return "You have marked today as Day-Off.";
    }

    if (!lastAttendance) return 'Ready to start your day!';
    
    return `Last action: ${lastAttendance.action.toUpperCase()} ${formatDistanceToNow(parseISO(lastAttendance.time), { addSuffix: true })}`;
  }
  
  const dailyTarget = useMemo(() => {
    if(!selectedUser) return 8;
    const isFriday = getDay(new Date()) === 5;
    return isFriday ? (selectedUser.friday_target_hours || selectedUser.daily_target_hours) : selectedUser.daily_target_hours;
  }, [selectedUser])

  if (isLoadingLast || isLoadingToday || isLoadingMonth) {
      return (
        <Card className="w-full max-w-lg text-center shadow-lg">
            <CardHeader>
                <Skeleton className="h-8 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-1/2 mx-auto mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-6 w-48 mx-auto my-4" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </CardContent>
             <CardFooter className="text-center justify-center">
                <Skeleton className="h-4 w-3/4 mx-auto" />
            </CardFooter>
        </Card>
      )
  }

  return (
    <>
    <div className="space-y-4 w-full max-w-lg">
        <Card className="text-center shadow-lg animate-fade-in">
        <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary">Welcome, {selectedUser?.name}</CardTitle>
            <CardDescription>Ready to start your day?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 bg-muted/50 p-4 rounded-lg">
                <div className="flex flex-col items-center justify-center">
                    <p className="text-sm text-muted-foreground">Time Worked Today</p>
                    <p className={cn("text-3xl font-bold font-code tabular-nums", timeWorkedColor)}>
                    {formatDuration(liveSecondsToday)}
                    </p>
                </div>
                {todaysEarnings !== null && (
                    <div className="flex flex-col items-center justify-center border-t border-border/50 pt-2">
                        <p className="text-sm text-muted-foreground">Today's Earnings</p>
                        <p className="flex items-center text-2xl font-bold font-code text-primary/90 tabular-nums">
                            <DollarSign className="h-6 w-6 mr-1" />
                            {todaysEarnings.toFixed(2)}
                        </p>
                    </div>
                )}
            </div>
            
            {dailyTarget && (
                <div className="space-y-2">
                    <Progress value={dailyProgressPercentage} indicatorClassName={dailyProgressColor} />
                    <div className="text-sm text-muted-foreground">
                        {dailyProgressPercentage >= 100 ? (
                            <div className="flex items-center justify-center font-semibold text-green-600">
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Goal Reached!
                            </div>
                        ) : (
                            <span>
                                {(liveSecondsToday/3600).toFixed(2)} hours worked out of {dailyTarget} target hours.
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
                <Button size="lg" className="w-full text-lg py-8 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleClockAction('in')} disabled={isSubmitting || !canClockIn}>
                    <LogIn className="mr-2 h-6 w-6" /> Clock In
                </Button>
                <Button size="lg" variant="destructive" className="w-full text-lg py-8" onClick={() => handleClockAction('out')} disabled={isSubmitting || !canClockOut}>
                    <LogOut className="mr-2 h-6 w-6" /> Clock Out
                </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
                <Button size="lg" variant="secondary" className="w-full text-lg py-8 bg-slate-600 hover:bg-slate-700 text-white" onClick={() => setShowConfirmation('absent')} disabled={isSubmitting || hasStaticMarkToday || canClockOut}>
                    <XCircle className="mr-2 h-6 w-6" /> Absent
                </Button>
                <Button size="lg" className="w-full text-lg py-8 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowConfirmation('day_off')} disabled={isSubmitting || hasStaticMarkToday || canClockOut}>
                    <CalendarCheck className="mr-2 h-6 w-6" /> Day-Off
                </Button>
            </div>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground justify-center min-h-[20px]">
            <p>{getDailyStatusMessage()}</p>
        </CardFooter>
        </Card>

        <Card className="shadow-lg animate-fade-in">
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                    <CalendarIcon className="h-5 w-5" />
                    Monthly Progress
                </CardTitle>
                <CardDescription>Your work progress for {format(new Date(), 'MMMM yyyy')}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <Progress value={monthlyProgressPercentage} />
                    <div className="flex justify-between text-sm font-medium text-muted-foreground">
                       <span className="flex items-center gap-1.5"><Hourglass className="h-4 w-4 text-green-500" /> Worked: <span className="text-foreground">{monthlyHoursWorked.toFixed(2)}h</span></span>
                       <span className="flex items-center gap-1.5"><Target className="h-4 w-4 text-primary" /> Target: <span className="text-foreground">{monthlyTargetHours.toFixed(2)}h</span></span>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>

     <AlertDialog open={!!showConfirmation} onOpenChange={(isOpen) => !isOpen && setShowConfirmation(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                {showConfirmation === 'day_off' 
                    ? "This will replace any hours worked today with a full paid Day-Off. This action cannot be undone."
                    : "This will replace any hours worked today with an unpaid absence record. This action cannot be undone."
                }
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStaticMark} className={showConfirmation === 'absent' ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary'}>
                Confirm
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
