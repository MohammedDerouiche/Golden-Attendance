
'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@/lib/supabase/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Edit, Trash2, MoreVertical, Calendar, User, Flag, CheckCircle, Circle, CircleDotDashed, Repeat, RotateCcw, Users } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { deleteTask, updateTask } from '@/lib/supabase/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface TaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: () => void;
  onStatusChange: () => void;
}

const priorityMap = {
    low: { label: 'Low', color: 'bg-blue-500', icon: <Flag className="h-3 w-3" /> },
    medium: { label: 'Medium', color: 'bg-yellow-500', icon: <Flag className="h-3 w-3" /> },
    high: { label: 'High', color: 'bg-red-500', icon: <Flag className="h-3 w-3" /> },
};

const statusMap = {
    not_started: { label: 'Not Started', icon: <Circle className="h-4 w-4 text-muted-foreground" /> },
    in_progress: { label: 'In Progress', icon: <CircleDotDashed className="h-4 w-4 text-yellow-500 animate-spin" /> },
    completed: { label: 'Completed', icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
};


export default function TaskItem({ task, onEdit, onDelete, onStatusChange }: TaskItemProps) {
    const { selectedUser } = useSelectedUser();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const canModify = selectedUser?.role === 'admin' || selectedUser?.id === task.created_by;

    const handleDelete = async () => {
        try {
            await deleteTask(task.id);
            toast({ title: 'Task Deleted', description: 'The task has been successfully deleted.' });
            onDelete();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error Deleting Task', description: error.message });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleStatusChange = async (newStatus: TaskStatus) => {
        setIsUpdatingStatus(true);
        try {
            await updateTask(task.id, { status: newStatus });
            toast({ title: 'Task Updated', description: `Task status set to "${statusMap[newStatus].label}".`});
            onStatusChange();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error Updating Task', description: error.message });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const getRecurrenceLabel = () => {
        switch (task.recurrence_type) {
            case 'daily': return 'Repeats Daily';
            case 'weekly': return 'Repeats Weekly';
            case 'monthly': return 'Repeats Monthly';
            case 'custom_days': return `Repeats every ${task.recurrence_interval} days`;
            default: return null;
        }
    };

    const priorityInfo = priorityMap[task.priority];
    const statusInfo = statusMap[task.status];
    const recurrenceLabel = getRecurrenceLabel();

    return (
        <>
            <Card className={cn(
                "flex flex-col",
                task.status === 'completed' && 'bg-muted/50 text-muted-foreground'
            )}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg pr-4">{task.title}</CardTitle>
                        {canModify && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onEdit(task)}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsDeleting(true)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                    <CardDescription>{task.description || 'No description.'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-grow">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                             <TooltipProvider><Tooltip>
                                <TooltipTrigger>{statusInfo.icon}</TooltipTrigger>
                                <TooltipContent><p>{statusInfo.label}</p></TooltipContent>
                            </Tooltip></TooltipProvider>
                            <span className={cn(task.status === 'completed' && 'line-through')}>{statusInfo.label}</span>
                        </div>
                        <Badge variant="outline" className={cn("flex items-center gap-1.5 text-white", priorityInfo.color)}>
                            {priorityInfo.icon}
                            {priorityInfo.label}
                        </Badge>
                    </div>
                     <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {task.due_date ? (
                            <span>Due: {format(new Date(task.due_date), 'PPP')}</span>
                        ) : (
                            <span>No due date</span>
                        )}
                    </div>
                    {recurrenceLabel && (
                         <div className="flex items-center gap-2 text-sm text-primary">
                             <TooltipProvider><Tooltip><TooltipTrigger>
                                <Repeat className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent><p>{recurrenceLabel}</p></TooltipContent>
                            </Tooltip></TooltipProvider>
                            <span>{recurrenceLabel}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Created by: {task.users_created_by?.name || 'Unknown'}</span>
                    </div>
                    {task.assigned_to && task.assigned_to.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                           <Users className="h-4 w-4 text-muted-foreground" />
                           <div className="flex -space-x-2">
                                {task.assigned_to.map(user => (
                                     <TooltipProvider key={user.id}><Tooltip>
                                        <TooltipTrigger asChild>
                                            <Avatar className="h-6 w-6 border-2 border-background">
                                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Assigned to {user.name}</p></TooltipContent>
                                     </Tooltip></TooltipProvider>
                                ))}
                           </div>
                           <span className="truncate">{task.assigned_to.map(u => u.name).join(', ')}</span>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                     <p className="text-xs text-muted-foreground">
                        Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                     </p>
                    {task.status === 'completed' ? (
                         <Button 
                            onClick={() => handleStatusChange('not_started')} 
                            disabled={isUpdatingStatus}
                            variant="outline"
                            size="sm"
                        >
                            <RotateCcw className="mr-2 h-4 w-4" /> Undo
                        </Button>
                    ) : (
                        <Button 
                            onClick={() => handleStatusChange('completed')} 
                            disabled={isUpdatingStatus}
                            variant="secondary"
                            size="sm"
                        >
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark as Complete
                        </Button>
                    )}
                </CardFooter>
            </Card>

            <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this task.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
