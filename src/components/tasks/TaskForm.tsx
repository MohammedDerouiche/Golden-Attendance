
'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { createTask, updateTask } from '@/lib/supabase/api';
import type { Task, TaskInsert, TaskUpdate, TaskRecurrence } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, ChevronsUpDown } from 'lucide-react';

const taskSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().optional().nullable(),
  status: z.enum(['not_started', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high']),
  assigned_to: z.array(z.string()).optional().nullable(),
  due_date: z.date().optional().nullable(),
  recurrence_type: z.enum(['none', 'daily', 'weekly', 'monthly', 'custom_days']),
  recurrence_interval: z.coerce.number().positive().optional().nullable(),
}).refine(data => {
    // Require recurrence_interval if recurrence_type is custom_days
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

export default function TaskForm({ task, onFinished }: TaskFormProps) {
  const { toast } = useToast();
  const { users, selectedUser } = useSelectedUser();
  const [open, setOpen] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'not_started',
      priority: 'medium',
      assigned_to: [],
      due_date: null,
      recurrence_type: 'none',
      recurrence_interval: undefined,
    },
  });

  const watchedRecurrenceType = form.watch('recurrence_type');

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigned_to: task.assigned_to?.map(u => u.id) || [],
        due_date: task.due_date ? new Date(task.due_date) : null,
        recurrence_type: task.recurrence_type || 'none',
        recurrence_interval: task.recurrence_interval || undefined,
      });
    } else {
      form.reset({
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        assigned_to: [],
        due_date: null,
        recurrence_type: 'none',
        recurrence_interval: undefined,
      });
    }
  }, [task, form]);

  const onSubmit = async (values: TaskFormValues) => {
    if (!selectedUser) {
        toast({ variant: 'destructive', title: 'You must be logged in to create a task.' });
        return;
    }

    try {
      if (task) {
        // Update task
        const updateData: TaskUpdate = {
          ...values,
          assigned_to: values.assigned_to && values.assigned_to.length > 0 ? values.assigned_to : null,
          due_date: values.due_date ? values.due_date.toISOString() : null,
        };
        await updateTask(task.id, updateData);
        toast({ title: 'Task Updated', description: 'The task has been successfully updated.' });
      } else {
        // Create task
        const insertData: TaskInsert = {
          ...values,
          created_by: selectedUser.id,
          assigned_to: values.assigned_to && values.assigned_to.length > 0 ? values.assigned_to : null,
          due_date: values.due_date ? values.due_date.toISOString() : null,
          original_task_id: undefined, // It's the first one
        };
        await createTask(insertData);
        toast({ title: 'Task Created', description: 'A new task has been successfully created.' });
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
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Assign To (Optional)</FormLabel>
                  <DropdownMenu open={open} onOpenChange={setOpen}>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between">
                            <span className="truncate">
                                {field.value && field.value.length > 0 
                                  ? `${field.value.length} user(s) selected` 
                                  : "Select users..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                          {users.map((user) => (
                              <DropdownMenuCheckboxItem
                                  key={user.id}
                                  checked={field.value?.includes(user.id)}
                                  onCheckedChange={(checked) => {
                                      const currentValues = field.value || [];
                                      return checked
                                          ? field.onChange([...currentValues, user.id])
                                          : field.onChange(currentValues.filter((value) => value !== user.id));
                                  }}
                                  onSelect={(e) => e.preventDefault()}
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
