
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createOrUpdateManualRecord } from '@/lib/supabase/api';
import type { Attendance, User } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { format, setHours, setMinutes, setSeconds, startOfDay, getDay } from 'date-fns';
import { CalendarIcon, User as UserIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Input } from './ui/input';
import { useSelectedUser } from '@/hooks/useSelectedUser';

const attendanceSchema = z.object({
  userId: z.string().optional(),
  date: z.date({ required_error: 'A date is required.' }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Invalid time format (HH:mm)"}).optional(),
  status: z.enum(['present_in', 'present_out', 'day_off', 'absent']),
  notes: z.string().optional().nullable(),
  paidHours: z.coerce.number().optional().nullable(),
  replacement_user_id: z.string().optional().nullable(),
});

type AttendanceFormValues = z.infer<typeof attendanceSchema>;

interface EditAttendanceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  record: Attendance | null;
  user: User;
  isDuplicating?: boolean;
}

export default function EditAttendanceSheet({ isOpen, onClose, record, user, isDuplicating = false }: EditAttendanceSheetProps) {
  const { toast } = useToast();
  const { users } = useSelectedUser();

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
        userId: user.id,
        date: new Date(),
        time: format(new Date(), 'HH:mm'),
        status: 'present_in',
        notes: '',
        paidHours: undefined,
        replacement_user_id: null,
    },
  });
  
  useEffect(() => {
    if (isOpen) {
      if (record) {
          const recordTime = new Date(record.time);
          let status: z.infer<typeof attendanceSchema>['status'] = 'present_in';
          if (record.status === 'day_off') status = 'day_off';
          else if (record.status === 'absent') status = 'absent';
          else if (record.action === 'out') status = 'present_out';

          form.reset({
              userId: user.id,
              date: recordTime,
              time: format(recordTime, 'HH:mm'),
              status: status,
              notes: record.notes,
              paidHours: record.paid_hours || undefined,
              replacement_user_id: record.replacement_user_id || null,
          });
      } else {
          form.reset({
              userId: user.id,
              date: new Date(),
              time: format(new Date(), 'HH:mm'),
              status: 'present_in',
              notes: '',
              paidHours: undefined,
              replacement_user_id: null,
          });
      }
    }
  }, [record, form, isOpen, user.id]);

  const watchedStatus = form.watch('status');
  const watchedDate = form.watch('date');
  const watchedUserId = form.watch('userId');

  const isTimeVisible = watchedStatus === 'present_in' || watchedStatus === 'present_out';
  const isPaidHoursVisible = watchedStatus === 'day_off';
  const isReplacementVisible = watchedStatus === 'day_off' || watchedStatus === 'absent';

  const otherUsers = useMemo(() => users.filter(u => u.id !== (watchedUserId || user.id)), [users, watchedUserId, user.id]);

  const targetUserForSubmission = useMemo(() => {
    return users.find(u => u.id === watchedUserId) || user;
  }, [watchedUserId, user, users]);

  useEffect(() => {
    if (isPaidHoursVisible) {
      const selectedDate = watchedDate || new Date();
      const isFriday = getDay(selectedDate) === 5;
      const hours = isFriday 
        ? (targetUserForSubmission.friday_target_hours || targetUserForSubmission.daily_target_hours)
        : targetUserForSubmission.daily_target_hours;
      form.setValue('paidHours', hours);
    } else {
      form.setValue('paidHours', undefined);
    }
  }, [isPaidHoursVisible, watchedDate, targetUserForSubmission, form]);
  
  const title = useMemo(() => {
    if (isDuplicating) return 'Duplicate Record';
    return record ? 'Edit Attendance Record' : 'Add New Record';
  }, [isDuplicating, record]);

  const description = useMemo(() => {
      if (isDuplicating) return `Create a new record by duplicating an existing one. You can change any value, including the user.`;
      return record ? 'Update the details of the attendance record.' : `Manually add a new record for ${user.name}.`;
  }, [isDuplicating, record, user.name]);

  const onSubmit = async (values: AttendanceFormValues) => {
    try {
        let combinedDateTime = startOfDay(values.date);
        if (values.time && (values.status === 'present_in' || values.status === 'present_out')) {
             const [hours, minutes] = values.time.split(':').map(Number);
             combinedDateTime = setHours(combinedDateTime, hours);
             combinedDateTime = setMinutes(combinedDateTime, minutes);
             combinedDateTime = setSeconds(combinedDateTime, 0);
        }
        
      const recordIdToUpdate = isDuplicating ? null : record?.id;
      const finalReplacementId = values.replacement_user_id === 'no-replacement' ? null : values.replacement_user_id;

      await createOrUpdateManualRecord({
          recordId: recordIdToUpdate,
          userId: values.userId || user.id,
          time: combinedDateTime,
          status: values.status,
          notes: values.notes,
          paidHours: values.paidHours,
          replacementUserId: finalReplacementId,
      });

      toast({
        title: recordIdToUpdate ? 'Record Updated' : 'Record Created',
        description: `The attendance record for ${targetUserForSubmission.name} has been saved.`,
      });

      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: error.message,
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
            {isDuplicating && (
                <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>User</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a user" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {users.map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            )}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status / Action</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an action" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="present_in">Clock In</SelectItem>
                      <SelectItem value="present_out">Clock Out</SelectItem>
                      <SelectItem value="day_off">Day-Off</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP")
                            ) : (
                                <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
                {isTimeVisible && (
                    <FormField
                        control={form.control}
                        name="time"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Time</FormLabel>
                            <FormControl>
                                <Input type="time" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                 {isPaidHoursVisible && (
                    <FormField
                        control={form.control}
                        name="paidHours"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Paid Hours</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                 )}
            </div>
             {isReplacementVisible && (
                <FormField
                    control={form.control}
                    name="replacement_user_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Replacement User (Optional)</FormLabel>
                             <Select onValueChange={field.onChange} value={field.value || 'no-replacement'}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a replacement" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="no-replacement">None</SelectItem>
                                    {otherUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
             )}
             <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g. Forgot to clock in this morning" {...field} value={field.value ?? ''}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter>
                <SheetClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </SheetClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

    