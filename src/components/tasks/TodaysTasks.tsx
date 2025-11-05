
'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { getTasks, updateTask, getPenaltySettings } from '@/lib/supabase/api';
import type { User, Task, TaskStatus, TaskPriority } from '@/lib/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { AlertTriangle, Check, ListChecks, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMemo } from 'react';
import { isToday, isPast } from 'date-fns';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';

const priorityMap = {
    low: { label: 'Low', color: 'bg-blue-500' },
    medium: { label: 'Medium', color: 'bg-yellow-500' },
    high: { label: 'High', color: 'bg-red-500' },
    urgent: { label: 'Urgent', color: 'bg-fuchsia-600' },
};

export default function TodaysTasks({ user }: { user: User }) {
    const { toast } = useToast();
    
    const { data: tasks, isLoading: isLoadingTasks, mutate } = useSWR(
        ['tasksForUser', user.id],
        () => getTasks(user.id, false, {}, undefined),
        { refreshInterval: 5000 }
    );
    
    const { data: penaltySettingsData, isLoading: isLoadingPenalties } = useSWR('penalty_settings', getPenaltySettings);
    
    const penaltySettings = useMemo(() => {
        if (!penaltySettingsData) return null;
        return penaltySettingsData.reduce((acc, setting) => {
            acc[setting.priority as TaskPriority] = setting.amount;
            return acc;
        }, {} as Record<TaskPriority, number>);
    }, [penaltySettingsData]);


    const { todaysTasks, overdueTasks } = useMemo(() => {
        if (!tasks) return { todaysTasks: [], overdueTasks: [] };
        
        const assignedTasks = tasks.filter(task => task.assigned_to?.id === user.id);

        const todays = assignedTasks.filter(task => 
            task.due_date && isToday(new Date(task.due_date)) && task.status !== 'completed'
        );
        
        const overdue = assignedTasks.filter(task => 
            task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'completed'
        );

        return { todaysTasks: todays, overdueTasks: overdue };
    }, [tasks, user.id]);

    const totalPenalty = useMemo(() => {
        if (!penaltySettings) return 0;
        return overdueTasks.reduce((acc, task) => {
            return acc + (penaltySettings[task.priority] || 0);
        }, 0);
    }, [overdueTasks, penaltySettings]);


    const handleStatusChange = async (task: Task, isComplete: boolean) => {
        const newStatus: TaskStatus = isComplete ? 'completed' : 'not_started';
        try {
            await updateTask(task.id, { status: newStatus });
            toast({ title: 'Task Updated' });
            mutate(); // Re-fetch tasks
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error updating task', description: error.message });
        }
    };
    
    const isLoading = isLoadingTasks || isLoadingPenalties;

    if (isLoading) {
        return <Skeleton className="h-48 w-full max-w-lg" />;
    }

    return (
        <div className="w-full max-w-lg space-y-4">
            {totalPenalty > 0 && (
                <Card className="bg-destructive/10 border-destructive animate-fade-in">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle />
                            Overdue Task Penalties
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-destructive">You have accumulated penalties from overdue tasks.</p>
                        <p className="text-3xl font-bold text-destructive">-${totalPenalty.toFixed(2)}</p>
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2"><ListChecks /> Today's Tasks</CardTitle>
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/tasks">View All <ArrowRight className="ml-2 h-4 w-4"/></Link>
                        </Button>
                    </div>
                    <CardDescription>
                        {todaysTasks.length > 0 ? `You have ${todaysTasks.length} task(s) due today.` : 'No tasks due today. Great job!'}
                    </CardDescription>
                </CardHeader>
                {todaysTasks.length > 0 && (
                    <CardContent>
                        <div className="space-y-3">
                            {todaysTasks.slice(0, 5).map(task => (
                                <div key={task.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                                    <Checkbox 
                                        id={`task-${task.id}`} 
                                        checked={task.status === 'completed'}
                                        onCheckedChange={(checked) => handleStatusChange(task, !!checked)}
                                    />
                                    <label htmlFor={`task-${task.id}`} className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        {task.title}
                                    </label>
                                    <Badge 
                                        variant="outline" 
                                        className={cn("text-white", priorityMap[task.priority].color)}
                                    >
                                        {priorityMap[task.priority].label}
                                    </Badge>
                                </div>
                            ))}
                            {todaysTasks.length > 5 && (
                                <p className="text-center text-sm text-muted-foreground pt-2">
                                    + {todaysTasks.length - 5} more...
                                </p>
                            )}
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
