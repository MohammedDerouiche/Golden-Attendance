
'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@/lib/supabase/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Edit, Trash2, MoreVertical, Circle, CircleDotDashed, CheckCircle, Folder } from 'lucide-react';
import { format } from 'date-fns';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { deleteTask, updateTask } from '@/lib/supabase/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Checkbox } from '../ui/checkbox';

interface TaskListTableProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: () => void;
  onStatusChange: () => void;
}

const priorityMap = {
    low: { label: 'Low', color: 'bg-blue-500' },
    medium: { label: 'Medium', color: 'bg-yellow-500' },
    high: { label: 'High', color: 'bg-red-500' },
};

const statusMap = {
    not_started: { label: 'Not Started', icon: <Circle className="h-4 w-4 text-muted-foreground" /> },
    in_progress: { label: 'In Progress', icon: <CircleDotDashed className="h-4 w-4 text-yellow-500" /> },
    completed: { label: 'Completed', icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
};

export default function TaskListTable({ tasks, onEdit, onDelete, onStatusChange }: TaskListTableProps) {
  const { selectedUser } = useSelectedUser();
  const { toast } = useToast();
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const canModify = (task: Task) => selectedUser?.role === 'admin' || selectedUser?.id === task.created_by || task.assigned_to?.id === selectedUser?.id;

  const handleDelete = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTask(taskToDelete.id);
      toast({ title: 'Task Deleted', description: 'The task has been successfully deleted.' });
      onDelete();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Deleting Task', description: error.message });
    } finally {
      setTaskToDelete(null);
    }
  };
  
  const handleStatusChange = async (task: Task, isComplete: boolean) => {
    const newStatus = isComplete ? 'completed' : 'not_started';
    try {
        await updateTask(task.id, { status: newStatus });
        toast({ title: 'Task Updated', description: `Task status set to "${statusMap[newStatus].label}".`});
        onStatusChange();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error Updating Task', description: error.message });
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed rounded-lg">
        <h3 className="text-xl font-semibold">No tasks found</h3>
        <p className="text-muted-foreground">Try adjusting your filters or create a new task!</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Done</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[250px]">Title</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
                const statusInfo = statusMap[task.status];
                const priorityInfo = priorityMap[task.priority];
                const isModifiable = canModify(task);

                return (
                    <TableRow key={task.id} className={cn(task.status === 'completed' && 'text-muted-foreground')}>
                        <TableCell>
                            <Checkbox
                                checked={task.status === 'completed'}
                                onCheckedChange={(checked) => handleStatusChange(task, !!checked)}
                                disabled={!isModifiable}
                                aria-label="Mark task as complete"
                            />
                        </TableCell>
                        <TableCell>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="flex items-center gap-2">{statusInfo.icon}</span>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{statusInfo.label}</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </TableCell>
                        <TableCell className="font-medium">
                            <span className={cn(task.status === 'completed' && 'line-through')}>{task.title}</span>
                            {task.description && <p className="text-xs text-muted-foreground truncate">{task.description}</p>}
                        </TableCell>
                        <TableCell>
                            {task.task_groups ? (
                                <Badge variant="secondary" className="flex items-center gap-1.5">
                                    <Folder className="h-3 w-3" />
                                    {task.task_groups.name}
                                </Badge>
                            ) : (
                                <span className="text-muted-foreground text-xs">No Group</span>
                            )}
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className={cn("text-white", priorityInfo.color)}>{priorityInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                            {task.assigned_to ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-7 w-7 border-2 border-background">
                                                    <AvatarFallback>{task.assigned_to.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span>{task.assigned_to.name}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{task.assigned_to.name}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <span className="text-muted-foreground text-xs">Unassigned</span>
                            )}
                        </TableCell>
                        <TableCell>{task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'N/A'}</TableCell>
                        <TableCell className="text-right">
                        {isModifiable && (
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
                                    <DropdownMenuItem onClick={() => setTaskToDelete(task)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        </TableCell>
                    </TableRow>
                )
            })}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={!!taskToDelete} onOpenChange={setTaskToDelete}>
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
