

'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@/lib/supabase/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Edit, Trash2, MoreVertical, Calendar, User, Flag, CheckCircle, Circle, CircleDotDashed, Repeat, RotateCcw, Folder, Image as ImageIcon, Briefcase, PlusSquare, AlertTriangle, ArrowRight, XCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { deleteTask, updateTask } from '@/lib/supabase/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import Image from 'next/image';

interface TaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: () => void;
  onStatusChange: () => void;
  onView: (task: Task) => void;
}

const priorityMap = {
    low: { label: 'Low', color: 'bg-blue-500', icon: <Flag className="h-3 w-3" /> },
    medium: { label: 'Medium', color: 'bg-yellow-500', icon: <Flag className="h-3 w-3" /> },
    high: { label: 'High', color: 'bg-red-500', icon: <Flag className="h-3 w-3" /> },
    urgent: { label: 'Urgent', color: 'bg-fuchsia-600', icon: <AlertTriangle className="h-3 w-3" /> },
};

const statusMap = {
    not_started: { label: 'Not Started', icon: <Circle className="h-4 w-4 text-muted-foreground" /> },
    in_progress: { label: 'In Progress', icon: <CircleDotDashed className="h-4 w-4 text-yellow-500 animate-spin" /> },
    completed: { label: 'Completed', icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
    undone: { label: 'Undone', icon: <XCircle className="h-4 w-4 text-destructive" /> },
};


export default function TaskItem({ task, onEdit, onDelete, onStatusChange, onView }: TaskItemProps) {
    const { selectedUser } = useSelectedUser();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const canModify = selectedUser?.role === 'admin' || selectedUser?.id === task.created_by;

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleting(true);
    };

    const confirmDelete = async () => {
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

    const handleStatusChange = async (e: React.MouseEvent, newStatus: TaskStatus) => {
        e.stopPropagation();
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
    
    const isCreator = selectedUser?.id === task.created_by;
    const isAssignee = selectedUser?.id === task.assigned_to?.id;
    const showOwnershipBadge = selectedUser?.role !== 'admin' && (isCreator || isAssignee);

    return (
        <>
            <Card 
                className={cn(
                    "flex flex-col transition-shadow hover:shadow-md cursor-pointer",
                    (task.status === 'completed' || task.status === 'undone') && 'bg-muted/50 text-muted-foreground'
                )}
                onClick={() => onView(task)}
            >
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div className="pr-4">
                            <CardTitle className="text-lg">{task.title}</CardTitle>
                             {showOwnershipBadge && (
                                <Badge variant="secondary" className={cn("mt-2", isCreator ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800')}>
                                    {isCreator ? <PlusSquare className="mr-1.5 h-3 w-3"/> : <Briefcase className="mr-1.5 h-3 w-3"/>}
                                    {isCreator ? 'Created by you' : 'Assigned to you'}
                                </Badge>
                            )}
                        </div>
                        {canModify && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(task); }}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                    {task.task_groups && (
                        <div className="flex items-center gap-2 text-xs text-primary font-medium pt-1">
                            <Folder className="h-3 w-3" />
                            <span>{task.task_groups.name}</span>
                        </div>
                    )}
                    <CardDescription className="line-clamp-2 pt-1">{task.description || 'No description.'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-grow">
                    {task.image_urls && task.image_urls.length > 0 && (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                           <ImageIcon className="h-4 w-4 text-muted-foreground" />
                           <div className="flex gap-2">
                                {task.image_urls.slice(0, 3).map((url, index) => (
                                    <div key={index} className="relative h-14 w-14">
                                        <Image src={url} alt={`Task image ${index+1}`} layout="fill" className="rounded-md object-cover" />
                                    </div>
                                ))}
                                {task.image_urls.length > 3 && (
                                    <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center text-sm font-medium">
                                        +{task.image_urls.length - 3}
                                    </div>
                                )}
                           </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                             <TooltipProvider><Tooltip>
                                <TooltipTrigger>{statusInfo.icon}</TooltipTrigger>
                                <TooltipContent><p>{statusInfo.label}</p></TooltipContent>
                            </Tooltip></TooltipProvider>
                            <span className={cn((task.status === 'completed' || task.status === 'undone') && 'line-through')}>{statusInfo.label}</span>
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
                    <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex items-center gap-1.5">
                            <Avatar className="h-6 w-6 border-2 border-background">
                                <AvatarFallback>{task.assigned_to?.name?.charAt(0) || '?'}</AvatarFallback>
                            </Avatar>
                            Assigned to:
                            {task.original_assignee && (
                                <>
                                    <span className="line-through text-muted-foreground">{task.original_assignee.name}</span>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </>
                            )}
                            <span className="font-medium">{task.assigned_to?.name || 'Unassigned'}</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                     <p className="text-xs text-muted-foreground">
                        Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                     </p>
                    {task.status === 'completed' || task.status === 'undone' ? (
                         <Button 
                            onClick={(e) => handleStatusChange(e, 'not_started')} 
                            disabled={isUpdatingStatus}
                            variant="outline"
                            size="sm"
                        >
                            <RotateCcw className="mr-2 h-4 w-4" /> Reopen
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                             <Button 
                                onClick={(e) => handleStatusChange(e, 'undone')} 
                                disabled={isUpdatingStatus}
                                variant="destructive"
                                size="sm"
                            >
                                <XCircle className="mr-2 h-4 w-4" /> Undone
                            </Button>
                            <Button 
                                onClick={(e) => handleStatusChange(e, 'completed')} 
                                disabled={isUpdatingStatus}
                                variant="secondary"
                                size="sm"
                            >
                                <CheckCircle className="mr-2 h-4 w-4" /> Done
                            </Button>
                        </div>
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
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
