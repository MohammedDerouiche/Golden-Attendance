
'use client';
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { createAttendance, getTodaysAttendanceForUser, markAsDayOff, markAsAbsent, getMonthlyAttendanceForUser, createOrUpdateManualRecord } from '@/lib/supabase/api';
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
import { format, formatDistanceToNow, parseISO, getDay, startOfMonth, endOfMonth, eachDayOfInterval, isFriday, setHours, setMinutes } from 'date-fns';
import { Skeleton } from './ui/skeleton';
import { LogIn, LogOut, CheckCircle2, DollarSign, XCircle, CalendarCheck, Target, Hourglass, Calendar as CalendarIcon, User, Save } from 'lucide-react';
import type { Attendance, AttendanceStatus, User as UserType } from '@/lib/supabase/types';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import TodaysTasks from './tasks/TodaysTasks';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Input } from './ui/input';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

type ActionType = 'in' | 'out' | 'day_off' | 'absent';

const calculateWorkedHours = (attendance: Attendance[]): number => {
    let totalSeconds = 0;
    
    if (!attendance || attendance.length === 0) {
      return 0;
    }

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

export default function Clock() {
  const { selectedUser, users } = useSelectedUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [liveSecondsToday, setLiveSecondsToday] = useState(0);
  
  const [actionToConfirm, setActionToConfirm] = useState<ActionType | null>(null);
  const [recordDate, setRecordDate] = useState(new Date());
  const [recordTime, setRecordTime] = useState(format(new Date(), 'HH:mm'));

  const [replacementUserId, setReplacementUserId] = useState<string | null>(null);

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
    } else {
        setLiveSecondsToday(0);
    }
  }, [todaysAttendance]);

  const lastActionToday = useMemo(() => {
    if (!todaysAttendance || todaysAttendance.length === 0) return null;
    return todaysAttendance[todaysAttendance.length - 1];
  }, [todaysAttendance]);

  const hasStaticMarkToday = useMemo(() => {
    if (!todaysAttendance || todaysAttendance.length === 0) return false;
    return todaysAttendance.some(r => r.status === 'absent' || r.status === 'day_off');
  }, [todaysAttendance]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    // Only start the timer if the user's last action today was clock-in and their status is 'present'
    if (lastActionToday?.action === 'in' && !hasStaticMarkToday) {
      timer = setInterval(() => {
        setLiveSecondsToday(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lastActionToday, hasStaticMarkToday]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setLocation(null)
    );
  }, []);

  const openConfirmationDialog = (action: ActionType) => {
    setActionToConfirm(action);
    setRecordDate(new Date());
    setRecordTime(format(new Date(), 'HH:mm'));
  }
  
  const handleConfirmAction = async () => {
     if (!selectedUser || !actionToConfirm) return;
     setIsSubmitting(true);
     
     try {
        const [hours, minutes] = recordTime.split(':').map(Number);
        let combinedDateTime = setMinutes(setHours(recordDate, hours), minutes);

        let status: 'present_in' | 'present_out' | 'day_off' | 'absent' = 'present_in';
        let paidHours: number | undefined;
        let notes: string | undefined;

        switch (actionToConfirm) {
            case 'in':
                status = 'present_in';
                notes = 'Clocked in from main page';
                break;
            case 'out':
                status = 'present_out';
                notes = 'Clocked out from main page';
                break;
            case 'day_off':
                status = 'day_off';
                notes = 'Marked as Day-Off from main page';
                const isFriday = getDay(combinedDateTime) === 5;
                paidHours = isFriday 
                    ? (selectedUser.friday_target_hours || selectedUser.daily_target_hours)
                    : selectedUser.daily_target_hours;
                break;
            case 'absent':
                status = 'absent';
                notes = 'Marked as Absent from main page';
                break;
        }

        const finalReplacementId = replacementUserId === 'no-replacement' ? null : replacementUserId;

        await createOrUpdateManualRecord({
            userId: selectedUser.id,
            time: combinedDateTime,
            status: status,
            notes: notes,
            paidHours: paidHours,
            replacementUserId: finalReplacementId,
        });

        await mutateToday();
        await mutateMonth();
        toast({
            title: 'Successfully Recorded',
            description: 'Your attendance has been recorded.',
        });

     } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
     } finally {
        setIsSubmitting(false);
        setActionToConfirm(null);
        setReplacementUserId(null);
     }
  }
  
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

  const canClockIn = !hasStaticMarkToday && lastActionToday?.action !== 'in';
  const canClockOut = !hasStaticMarkToday && lastActionToday?.action === 'in';

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

    if (!lastActionToday) return 'Ready to start your day!';
    
    return `Last action: ${lastActionToday.action.toUpperCase()} ${formatDistanceToNow(parseISO(lastActionToday.time), { addSuffix: true })}`;
  }
  
  const dailyTarget = useMemo(() => {
    if(!selectedUser) return 8;
    const isFriday = getDay(new Date()) === 5;
    return isFriday ? (selectedUser.friday_target_hours || selectedUser.daily_target_hours) : selectedUser.daily_target_hours;
  }, [selectedUser])

  const otherUsers = useMemo(() => users.filter(u => u.id !== selectedUser?.id), [users, selectedUser]);

  const dialogContent = useMemo(() => {
    if (!actionToConfirm) return { title: '', description: '' };
    switch (actionToConfirm) {
        case 'in':
            return { title: 'Confirm Clock In', description: 'Please confirm the date and time for your clock-in record.' };
        case 'out':
            return { title: 'Confirm Clock Out', description: 'Please confirm the date and time for your clock-out record.' };
        case 'day_off':
            return { title: 'Confirm Day-Off', description: 'This will create a paid Day-Off record for the selected date.' };
        case 'absent':
            return { title: 'Confirm Absence', description: 'This will create an unpaid Absence record for the selected date.' };
    }
  }, [actionToConfirm]);

  const isTimeVisible = actionToConfirm === 'in' || actionToConfirm === 'out';
  const isReplacementVisible = actionToConfirm === 'day_off' || actionToConfirm === 'absent';


  if (isLoadingToday || isLoadingMonth) {
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
                <Button size="lg" className="w-full text-lg py-8 bg-green-600 hover:bg-green-700 text-white" onClick={() => openConfirmationDialog('in')} disabled={isSubmitting || !canClockIn}>
                    <LogIn className="mr-2 h-6 w-6" /> Clock In
                </Button>
                <Button size="lg" variant="destructive" className="w-full text-lg py-8" onClick={() => openConfirmationDialog('out')} disabled={isSubmitting || !canClockOut}>
                    <LogOut className="mr-2 h-6 w-6" /> Clock Out
                </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
                <Button size="lg" variant="secondary" className="w-full text-lg py-8 bg-slate-600 hover:bg-slate-700 text-white" onClick={() => openConfirmationDialog('absent')} disabled={isSubmitting || hasStaticMarkToday || canClockOut}>
                    <XCircle className="mr-2 h-6 w-6" /> Absent
                </Button>
                <Button size="lg" className="w-full text-lg py-8 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => openConfirmationDialog('day_off')} disabled={isSubmitting || hasStaticMarkToday || canClockOut}>
                    <CalendarCheck className="mr-2 h-6 w-6" /> Day-Off
                </Button>
            </div>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground justify-center min-h-[20px]">
            <p>{getDailyStatusMessage()}</p>
        </CardFooter>
        </Card>

        {selectedUser && <TodaysTasks user={selectedUser} />}

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

    <AlertDialog open={!!actionToConfirm} onOpenChange={(isOpen) => !isOpen && setActionToConfirm(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
                <AlertDialogDescription>{dialogContent.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="record-date">Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="record-date"
                                    variant="outline"
                                    className={cn("w-full justify-start text-left font-normal", !recordDate && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {recordDate ? format(recordDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={recordDate} onSelect={(d) => d && setRecordDate(d)} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                    {isTimeVisible && (
                        <div className="space-y-2">
                            <Label htmlFor="record-time">Time</Label>
                            <Input id="record-time" type="time" value={recordTime} onChange={(e) => setRecordTime(e.target.value)} />
                        </div>
                    )}
                </div>

                {isReplacementVisible && (
                    <div className="space-y-2">
                        <Label htmlFor="replacement-user">Replacement User (Optional)</Label>
                        <Select onValueChange={setReplacementUserId} value={replacementUserId || 'no-replacement'}>
                            <SelectTrigger id="replacement-user">
                                <SelectValue placeholder="Select a user to cover your shift" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no-replacement">None</SelectItem>
                                {otherUsers.map(user => (
                                    <SelectItem key={user.id} value={user.id}>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            {user.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setReplacementUserId(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmAction} disabled={isSubmitting}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? 'Saving...' : 'Confirm'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
