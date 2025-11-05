

'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@/lib/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar, User, Flag, CheckCircle, Circle, CircleDotDashed, Repeat, Folder, Image as ImageIcon, RotateCcw, ArrowRight, XCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { updateTask } from '@/lib/supabase/api';
import Image from 'next/image';

interface TaskDetailDialogProps {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
    onStatusChange: () => void;
}

const priorityMap = {
    low: { label: 'Low', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    high: { label: 'High', className: 'bg-red-100 text-red-800 border-red-200' },
    urgent: { label: 'Urgent', className: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
};

const statusMap = {
    not_started: { label: 'Not Started', icon: <Circle className="h-4 w-4 text-slate-500" /> },
    in_progress: { label: 'In Progress', icon: <CircleDotDashed className="h-4 w-4 text-yellow-500 animate-spin" /> },
    completed: { label: 'Completed', icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
    undone: { label: 'Undone', icon: <XCircle className="h-4 w-4 text-destructive" /> },
};


export default function TaskDetailDialog({ task, isOpen, onClose, onStatusChange }: TaskDetailDialogProps) {
    const { toast } = useToast();
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const handleStatusChange = async (newStatus: TaskStatus) => {
        setIsUpdatingStatus(true);
        try {
            await updateTask(task.id, { status: newStatus });
            toast({ title: 'Task Updated', description: `Task status set to "${statusMap[newStatus].label}".`});
            onStatusChange();
            if (newStatus === 'completed' || newStatus === 'undone') {
                onClose();
            }
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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
                <DialogHeader className="p-6 pb-4">
                    <DialogTitle className="text-2xl">{task.title}</DialogTitle>
                    <DialogDescription>Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="px-6">
                    <div className="space-y-6">
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                {statusInfo.icon}
                                <span>{statusInfo.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Flag className="h-4 w-4" />
                                <Badge variant="outline" className={cn('border', priorityInfo.className)}>{priorityInfo.label}</Badge>
                            </div>
                            {recurrenceLabel && (
                                <div className="flex items-center gap-2 text-primary">
                                    <Repeat className="h-4 w-4" />
                                    <span>{recurrenceLabel}</span>
                                </div>
                            )}
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                             <div className="flex items-start gap-3">
                                <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                <div>
                                    <p className="font-semibold">Due Date</p>
                                    <p>{task.due_date ? format(new Date(task.due_date), 'PPP') : 'Not set'}</p>
                                </div>
                            </div>
                             <div className="flex items-start gap-3">
                                <User className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                <div>
                                    <p className="font-semibold">Assigned To</p>
                                    <div className="flex items-center gap-2">
                                        {task.original_assignee && (
                                            <>
                                            <span className="line-through">{task.original_assignee.name}</span>
                                            <ArrowRight className="h-4 w-4" />
                                            </>
                                        )}
                                        <span>{task.assigned_to?.name || 'Unassigned'}</span>
                                    </div>
                                </div>
                            </div>
                             <div className="flex items-start gap-3">
                                <User className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                <div>
                                    <p className="font-semibold">Created By</p>
                                    <p>{task.users_created_by?.name || 'Unknown'}</p>
                                </div>
                            </div>
                            {task.task_groups && (
                                <div className="flex items-start gap-3">
                                    <Folder className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                    <div>
                                        <p className="font-semibold">Group</p>
                                        <p>{task.task_groups.name}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {task.description && (
                            <div>
                                <h4 className="font-semibold mb-2">Description</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                            </div>
                        )}
                        
                        {task.image_urls && task.image_urls.length > 0 && (
                             <div>
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4"/>
                                    Attachments
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {task.image_urls.map((url, index) => (
                                        <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="relative aspect-video overflow-hidden rounded-lg">
                                            <Image src={url} alt={`Task image ${index+1}`} layout="fill" className="object-cover transition-transform hover:scale-105" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </ScrollArea>
                <DialogFooter className="p-6 bg-muted/50 border-t flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0">
                    {task.status === 'completed' || task.status === 'undone' ? (
                         <Button 
                            onClick={() => handleStatusChange('not_started')} 
                            disabled={isUpdatingStatus}
                            variant="outline"
                            className="w-full"
                        >
                            <RotateCcw className="mr-2 h-4 w-4" /> Reopen Task
                        </Button>
                    ) : (
                        <div className="w-full flex flex-col sm:flex-row gap-2">
                             <Button 
                                onClick={() => handleStatusChange('undone')} 
                                disabled={isUpdatingStatus}
                                variant="destructive"
                                className="w-full"
                            >
                                <XCircle className="mr-2 h-4 w-4" /> Mark as Undone
                            </Button>
                            <Button 
                                onClick={() => handleStatusChange('completed')} 
                                disabled={isUpdatingStatus}
                                className="w-full"
                            >
                                <CheckCircle className="mr-2 h-4 w-4" /> Mark as Complete
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
