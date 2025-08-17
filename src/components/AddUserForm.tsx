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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { createUser, updateUser } from '@/lib/supabase/api';
import type { User, UserUpdate } from '@/lib/supabase/types';
import { useEffect } from 'react';

const userSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  phone: z.string().optional().nullable(),
  role: z.enum(['employee', 'admin']),
  position: z.string().optional().nullable(),
  monthly_salary: z.coerce.number().positive().optional().nullable(),
  daily_target_hours: z.coerce.number().min(1, {message: 'Target must be at least 1 hour'}).max(24, {message: 'Target cannot exceed 24 hours'}),
  friday_target_hours: z.coerce.number().min(0).max(24).optional().nullable(),
  password: z.string().optional().nullable(),
});

type UserFormValues = z.infer<typeof userSchema>;

interface AddUserFormProps {
  onFinished: () => void;
  defaultValues?: User;
}

export default function AddUserForm({ onFinished, defaultValues }: AddUserFormProps) {
  const { toast } = useToast();
  const { mutateUsers, setSelectedUser, selectedUser } = useSelectedUser();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      phone: defaultValues?.phone || '',
      role: defaultValues?.role || 'employee',
      position: defaultValues?.position || '',
      monthly_salary: defaultValues?.monthly_salary || undefined,
      daily_target_hours: defaultValues?.daily_target_hours || 8,
      friday_target_hours: defaultValues?.friday_target_hours || undefined,
      password: '', // Always start empty, never show old password
    },
  });

  const watchedRole = form.watch('role');

  useEffect(() => {
    if (watchedRole === 'employee') {
      form.setValue('password', null);
    }
  }, [watchedRole, form]);

  const onSubmit = async (values: UserFormValues) => {
    try {
      let user;

      if (defaultValues) {
        // UPDATE LOGIC
        const updateData: UserUpdate = {
            name: values.name,
            phone: values.phone,
            role: values.role,
            position: values.position,
            monthly_salary: values.monthly_salary,
            daily_target_hours: values.daily_target_hours,
            friday_target_hours: values.friday_target_hours,
        };

        // Only include password in update if a new one was typed
        if (values.role === 'admin' && values.password) {
            updateData.password = values.password;
        }

        // If role changed to employee, nullify the password
        if (values.role === 'employee') {
            updateData.password = null;
        }

        user = await updateUser(defaultValues.id, updateData);
        if (selectedUser?.id === user.id) {
          setSelectedUser(user);
        }
        toast({
          title: 'User Updated',
          description: `${user.name} has been updated successfully.`,
        });

      } else {
        // CREATE LOGIC
        if (values.role === 'admin' && !values.password) {
          values.password = '123456'; // Default password for new admins
        } else if (values.role === 'employee') {
          values.password = null;
        }

        user = await createUser(values);
        setSelectedUser(user);
        toast({
          title: 'User Created',
          description: `${user.name} has been created and selected.`,
        });
      }
      await mutateUsers();
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="555-123-4567" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
            {watchedRole === 'admin' && (
                 <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                            <Input type="password" placeholder={defaultValues ? "Leave blank to keep unchanged" : "Default: 123456"} {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            )}
        </div>
        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Position (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Software Engineer" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={form.control}
            name="monthly_salary"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Monthly Salary (Optional)</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="5000" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="daily_target_hours"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Daily Target (Hours)</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="8" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
                control={form.control}
                name="friday_target_hours"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Friday Target (Hours)</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="e.g. 3.75" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Saving...' : defaultValues ? 'Save Changes' : 'Create User'}
        </Button>
      </form>
    </Form>
  );
}
