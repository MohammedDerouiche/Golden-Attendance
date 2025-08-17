
'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { createTask, updateTask, getTaskGroups, createTaskGroup } from '@/lib/supabase/api';
import type { Task, TaskInsert, TaskUpdate } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Plus } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Label } from '@/components/ui/label';


const taskSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().optional().nullable(),
  status: z.enum(['not_started', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high']),
  assigned_to: z.array(z.string()).optional(),
  due_date: z.date().optional().nullable(),
  group_id: z.string().optional().nullable(),
  recurrence_type: z.enum(['none', 'daily', 'weekly', 'monthly', 'custom_days']),
  recurrence_interval: z.coerce.number().positive().optional().nullable(),
}).refine(data => {
    if (data.recurrence_type === 'custom_days') {
        return data.recurrence_interval != null && data.recurrence_interval > 0;
    }
    return true;
}, {
    message: "Interval is required for custom recurrence.",
    path: ["recurrence_interval"],
});


type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  task: Task | null;
  onFinished: () => void;
}

function CreateGroupDialog({ onGroupCreated }: { onGroupCreated: (newGroup: any) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleCreate = async () => {
        if (!groupName.trim()) {
            toast({ variant: 'destructive', title: 'Group name cannot be empty.' });
            return;
        }
        setIsSaving(true);
        try {
            const newGroup = await createTaskGroup(groupName);
            toast({ title: 'Group Created', description: `Successfully created group "${newGroup.name}".`});
            onGroupCreated(newGroup);
            setIsOpen(false);
            setGroupName('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error creating group', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Task Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input 
                        id="group-name" 
                        value={groupName} 
                        onChange={(e) => setGroupName(e.target.value)} 
                        placeholder="e.g., Marketing Campaign"
                    />
                </div>
                <div className="flex justify-end gap-2">
                     <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                     <Button onClick={handleCreate} disabled={isSaving}>
                        {isSaving ? 'Creating...' : 'Create'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default function TaskForm({ task, onFinished }: TaskFormProps) {
  const { toast } = useToast();
  const { users, selectedUser } = useSelectedUser();
  const { data: taskGroups, mutate: mutateGroups } = useSWR('task_groups', getTaskGroups);


  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        assigned_to: [],
        due_date: null,
        group_id: 'no-group',
        recurrence_type: 'none',
        recurrence_interval: undefined,
    },
  });
  
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        status: task.status,
        priority: task.priority,
        assigned_to: task.assigned_to ? [task.assigned_to.id] : [],
        due_date: task.due_date ? new Date(task.due_date) : null,
        group_id: task.group_id ?? 'no-group',
        recurrence_type: task.recurrence_type || 'none',
        recurrence_interval: task.recurrence_interval ?? undefined,
      });
    } else {
      form.reset({
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        assigned_to: [],
        due_date: null,
        group_id: 'no-group',
        recurrence_type: 'none',
        recurrence_interval: undefined,
      });
    }
  }, [task, form]);

  const watchedRecurrenceType = form.watch('recurrence_type');
  const assignedUsers = form.watch('assigned_to') || [];
  
  const onSubmit = async (values: TaskFormValues) => {
    if (!selectedUser) {
        toast({ variant: 'destructive', title: 'You must be logged in to create a task.' });
        return;
    }

    try {
        const groupId = values.group_id === 'no-group' ? null : values.group_id;

        if (task) { // This is an update
             const updateData: TaskUpdate = {
                title: values.title,
                description: values.description,
                status: values.status,
                priority: values.priority,
                due_date: values.due_date ? values.due_date.toISOString() : null,
                assigned_to: values.assigned_to?.[0] || null,
                group_id: groupId,
                recurrence_type: values.recurrence_type,
                recurrence_interval: values.recurrence_interval,
            };
            await updateTask(task.id, updateData);
            toast({ title: 'Task Updated', description: 'The task has been successfully updated.' });

        } else { // This is a create
            const insertData: TaskInsert = {
                title: values.title,
                description: values.description,
                status: values.status,
                priority: values.priority,
                due_date: values.due_date ? values.due_date.toISOString() : null,
                created_by: selectedUser.id,
                assigned_to: values.assigned_to,
                group_id: groupId,
                recurrence_type: values.recurrence_type,
                recurrence_interval: values.recurrence_interval,
            };
            await createTask(insertData);
            toast({ title: 'Task(s) Created', description: 'A new task has been successfully created for each assigned user.' });
        }
        onFinished();
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'An error occurred',
            description: error.message,
        });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Design the new homepage" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Add more details about the task..." {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                    <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a priority" /></SelectTrigger></FormControl>
                    <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Assign To</FormLabel>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <FormControl>
                            <Button
                            variant="outline"
                            className="w-full justify-start h-auto min-h-10 text-left font-normal"
                            >
                            <div className="flex gap-1 flex-wrap">
                                {assignedUsers.length === 0 ? <span className="text-muted-foreground">Select users...</span> :
                                users
                                .filter((user) => assignedUsers.includes(user.id))
                                .map((user) => (
                                    <Badge
                                    variant="secondary"
                                    key={user.id}
                                    className="mr-1"
                                    >
                                    {user.name}
                                    </Badge>
                                ))}
                            </div>
                            </Button>
                        </FormControl>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                        {users.map((user) => (
                           <DropdownMenuCheckboxItem
                            key={user.id}
                            checked={field.value?.includes(user.id)}
                            onCheckedChange={(checked) => {
                                return checked
                                ? field.onChange([...(field.value || []), user.id])
                                : field.onChange(
                                    field.value?.filter(
                                    (value) => value !== user.id
                                    )
                                )
                            }}
                            onSelect={(e) => e.preventDefault()} // prevent menu from closing on select
                          >
                            {user.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                   </DropdownMenu>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        <FormField
            control={form.control}
            name="group_id"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Group (Optional)</FormLabel>
                    <div className="flex items-center gap-2">
                        <Select onValueChange={field.onChange} value={field.value || 'no-group'}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Assign to a group" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="no-group">No Group</SelectItem>
                                {taskGroups?.map(group => (
                                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <CreateGroupDialog 
                            onGroupCreated={(newGroup) => {
                                mutateGroups(); // Re-fetch groups
                                field.onChange(newGroup.id); // Set the new group as selected
                            }}
                        />
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
        
        <div className="space-y-2 rounded-md border p-4">
            <h3 className="font-medium">Recurrence</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="recurrence_type"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Repeats</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select recurrence" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="custom_days">Every # of Days</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                {watchedRecurrenceType === 'custom_days' && (
                     <FormField
                        control={form.control}
                        name="recurrence_interval"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Interval (Days)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g. 3" {...field} value={field.value ?? ''} />
                            </FormControl>
                             <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
             <FormDescription>
                When a recurring task is completed, a new one will be created automatically.
            </FormDescription>
        </div>


        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Saving...' : 'Save Task'}
        </Button>
      </form>
    </Form>
  );
}

