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
import { Input } from '@/components/ui/input';
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
import { createAttendance, updateAttendance } from '@/lib/supabase/api';
import type { Attendance } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { format, setHours, setMinutes, setSeconds, startOfDay, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useEffect } from 'react';

const attendanceSchema = z.object({
  date: z.date({ required_error: 'A date is required.' }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Invalid time format (HH:mm)"}),
  action: z.enum(['in', 'out']),
  notes: z.string().optional().nullable(),
});

type AttendanceFormValues = z.infer<typeof attendanceSchema>;

interface EditAttendanceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  record: Attendance | null;
  userId: string;
}

export default function EditAttendanceSheet({ isOpen, onClose, record, userId }: EditAttendanceSheetProps) {
  const { toast } = useToast();

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
        date: new Date(),
        time: format(new Date(), 'HH:mm'),
        action: 'in',
        notes: '',
    },
  });
  
  useEffect(() => {
    if (record) {
        const recordTime = new Date(record.time);
        form.reset({
            date: recordTime,
            time: format(recordTime, 'HH:mm'),
            action: record.action,
            notes: record.notes,
        });
    } else {
        form.reset({
            date: new Date(),
            time: format(new Date(), 'HH:mm'),
            action: 'in',
            notes: '',
        });
    }
  }, [record, form, isOpen]);


  const onSubmit = async (values: AttendanceFormValues) => {
    try {
        const [hours, minutes] = values.time.split(':').map(Number);
        let combinedDateTime = startOfDay(values.date);
        combinedDateTime = setHours(combinedDateTime, hours);
        combinedDateTime = setMinutes(combinedDateTime, minutes);
        combinedDateTime = setSeconds(combinedDateTime, 0);

      const submissionData = {
          user_id: userId,
          time: combinedDateTime.toISOString(),
          action: values.action,
          notes: values.notes,
      };

      if (record) {
        // Update existing record
        await updateAttendance(record.id, {
            ...submissionData,
            latitude: record.latitude, // Preserve original location
            longitude: record.longitude
        });
        toast({
          title: 'Record Updated',
          description: 'The attendance record has been updated.',
        });
      } else {
        // Create new record
        await createAttendance(submissionData);
        toast({
          title: 'Record Created',
          description: 'A new attendance record has been created.',
        });
      }
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
          <SheetTitle>{record ? 'Edit Attendance Record' : 'Add New Record'}</SheetTitle>
          <SheetDescription>
            {record ? 'Update the details of the attendance record.' : 'Manually add a new clock-in or clock-out event.'}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] pl-3 text-left font-normal",
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
             <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                        <Input type="time" {...field} className="w-[120px]" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select an action" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="in">Clock In</SelectItem>
                      <SelectItem value="out">Clock Out</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
