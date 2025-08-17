

import { supabase } from './client';
import type { UserInsert, UserUpdate, AttendanceInsert, AttendanceUpdate, Attendance, ActiveEmployee, Task, TaskInsert, TaskUpdate, TaskStatus, TaskPriority, TaskRecurrence, User } from './types';
import { startOfDay, endOfDay, addDays, addWeeks, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import type { DateRange } from 'react-day-picker';

// User Functions
export const getUsers = async () => {
  const { data, error } = await supabase.from('users').select('*').order('name');
  if (error) throw error;
  return data;
};

export const createUser = async (userData: UserInsert) => {
  const { data, error } = await supabase.from('users').insert(userData).select().single();
  if (error) throw error;
  return data;
};

export const updateUser = async (userId: string, userData: UserUpdate) => {
    const { data, error } = await supabase.from('users').update(userData).eq('id', userId).select().single();
    if (error) throw error;
    return data;
};

export const deleteUser = async (userId: string) => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
    return true;
};

// Attendance Functions
export const getAttendanceForUser = async (
  userId: string | null, // Allow null to fetch for all users
  startDate?: Date,
  endDate?: Date,
  action?: 'in' | 'out' | 'all',
  searchText?: string
): Promise<Attendance[]> => {
  let query = supabase
    .from('attendance')
    .select('*')
    .order('time', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (startDate) {
    query = query.gte('time', startDate.toISOString());
  }
  if (endDate) {
    endDate.setHours(23, 59, 59, 999);
    query = query.lte('time', endDate.toISOString());
  }
  
  if (action && action !== 'all') {
    query = query.eq('action', action);
  }

  if (searchText) {
    // Assuming search should be on 'notes' column
    query = query.ilike('notes', `%${searchText}%`);
  }


  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getTodaysAttendanceForUser = async (userId: string): Promise<Attendance[]> => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .gte('time', todayStart.toISOString())
        .lte('time', todayEnd.toISOString())
        .order('time', { ascending: true });
    
    if (error) throw error;
    return data;
};

export const getMonthlyAttendanceForUser = async (userId: string, date: Date): Promise<Attendance[]> => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .gte('time', monthStart.toISOString())
        .lte('time', monthEnd.toISOString())
        .order('time', { ascending: true });
    
    if (error) throw error;
    return data;
};


export const getAttendanceById = async (id: string) => {
    const { data, error } = await supabase.from('attendance').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
};

export const createAttendance = async (attendanceData: AttendanceInsert): Promise<Attendance> => {
  const { data, error } = await supabase.from('attendance').insert(attendanceData).select().single();
  if (error) throw error;
  return data;
};

export const updateAttendance = async (id: string, attendanceData: AttendanceUpdate): Promise<Attendance> => {
    const { data, error } = await supabase.from('attendance').update(attendanceData).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const deleteAttendance = async (id: string) => {
    const { error } = await supabase.from('attendance').delete().eq('id', id);
    if (error) throw error;
    return true;
};

export const getLastAttendanceForUser = async (userId: string) => {
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .order('time', { ascending: false })
        .limit(1)
        .single();
    
    // It's okay if there's no record, so we don't throw error for "single row not found"
    if (error && error.code !== 'PGRST116') {
        throw error;
    }
    return data;
};

export const getActiveEmployees = async (): Promise<ActiveEmployee[]> => {
    const { data, error } = await supabase.rpc('get_active_employees');
    if (error) throw error;
    return data;
};

export const markAsDayOff = async (userId: string, paidHours: number) => {
    const { error } = await supabase.rpc('mark_day_off_for_user', {
        p_user_id: userId,
        p_paid_hours: paidHours,
    });
    if (error) throw error;
    return true;
};

export const markAsAbsent = async (userId: string) => {
    const { error } = await supabase.rpc('mark_absent_for_user', {
        p_user_id: userId,
    });
    if (error) throw error;
    return true;
};

export const createOrUpdateManualRecord = async (
    { recordId, userId, time, status, notes, paidHours }: 
    { recordId?: string | null, userId: string, time: Date, status: string, notes?: string | null, paidHours?: number | null }
) => {
    let submission: AttendanceInsert | AttendanceUpdate = {
        user_id: userId,
        time: time.toISOString(),
        notes: notes,
    };

    switch(status) {
        case 'present_in':
            submission = { ...submission, action: 'in', status: 'present', paid_hours: null };
            break;
        case 'present_out':
            submission = { ...submission, action: 'out', status: 'present', paid_hours: null };
            break;
        case 'day_off':
            submission = { ...submission, action: 'in', status: 'day_off', paid_hours: paidHours };
            break;
        case 'absent':
            submission = { ...submission, action: 'in', status: 'absent', paid_hours: null };
            break;
    }

    if (recordId) {
        const { error } = await supabase.from('attendance').update(submission).eq('id', recordId);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('attendance').insert(submission);
        if (error) throw error;
    }

    return true;
}


// Task Functions
export const getTasks = async (
    userId: string | null, // Allow null for admin fetching all
    isAdmin: boolean, 
    filters: { status?: TaskStatus, priority?: TaskPriority, assignedTo?: string },
    dateFilter?: Date | DateRange
): Promise<Task[]> => {
    let query = supabase
        .from('tasks')
        .select(`
            id,
            title,
            description,
            status,
            priority,
            due_date,
            created_at,
            created_by,
            recurrence_type,
            recurrence_interval,
            original_task_id,
            users_created_by:created_by ( id, name ),
            assigned_to
        `)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (!isAdmin && userId) {
        query = query.or(`created_by.eq.${userId},assigned_to.cs.{${userId}}`);
    }

    if (filters.status) {
        query = query.eq('status', filters.status);
    }
    if (filters.priority) {
        query = query.eq('priority', filters.priority);
    }
    if (filters.assignedTo) {
        query = query.contains('assigned_to', [filters.assignedTo]);
    }

    if (dateFilter) {
        if (dateFilter instanceof Date) {
            const from = startOfDay(dateFilter).toISOString();
            const to = endOfDay(dateFilter).toISOString();
            query = query.gte('due_date', from).lte('due_date', to);
        } else if (dateFilter.from) {
             const from = startOfDay(dateFilter.from).toISOString();
             const to = endOfDay(dateFilter.to || dateFilter.from).toISOString();
             query = query.gte('due_date', from).lte('due_date', to);
        }
    }

    const { data: tasksData, error } = await query;
    if (error) {
        console.error("Error fetching tasks:", error);
        throw error;
    };

    // Manually fetch assigned users
    const allUserIds = new Set<string>();
    tasksData?.forEach(task => {
        if(task.assigned_to) {
            task.assigned_to.forEach(uid => allUserIds.add(uid));
        }
    });

    if (users) {
        const { data: users, error: userError } = await supabase.from('users').select('id, name').in('id', Array.from(allUserIds));
        if(userError) {
            console.error("Error fetching assigned users:", userError);
            throw userError;
        }
        const userMap = new Map(users.map(u => [u.id, u as User]));

        const result: Task[] = tasksData?.map(task => ({
            ...task,
            assigned_to: task.assigned_to ? task.assigned_to.map(uid => userMap.get(uid)!).filter(Boolean) : null,
        })) || [];

        return result;
    }
    return tasksData as Task[];
};

export const createTask = async (taskData: TaskInsert) => {
    const { data, error } = await supabase.from('tasks').insert(taskData).select().single();
    if (error) throw error;
    return data;
};

const getNextDueDate = (dueDate: Date, recurrenceType: TaskRecurrence, interval?: number | null): Date | null => {
    if (!dueDate) return null;
    switch (recurrenceType) {
        case 'daily':
            return addDays(dueDate, 1);
        case 'weekly':
            return addWeeks(dueDate, 1);
        case 'monthly':
            return addMonths(dueDate, 1);
        case 'custom_days':
            return addDays(dueDate, interval || 1);
        default:
            return null;
    }
};

export const updateTask = async (taskId: string, taskData: TaskUpdate) => {
    const { data: updatedTask, error } = await supabase.from('tasks').update(taskData).eq('id', taskId).select().single();
    if (error) throw error;

    // Handle recurring task creation
    if (updatedTask.status === 'completed' && updatedTask.recurrence_type && updatedTask.recurrence_type !== 'none') {
        const currentDueDate = updatedTask.due_date ? new Date(updatedTask.due_date) : new Date();
        const nextDueDate = getNextDueDate(currentDueDate, updatedTask.recurrence_type, updatedTask.recurrence_interval);

        if (nextDueDate) {
            const newTask: TaskInsert = {
                title: updatedTask.title,
                description: updatedTask.description,
                status: 'not_started',
                priority: updatedTask.priority,
                due_date: nextDueDate.toISOString(),
                created_by: updatedTask.created_by,
                assigned_to: updatedTask.assigned_to,
                recurrence_type: updatedTask.recurrence_type,
                recurrence_interval: updatedTask.recurrence_interval,
                original_task_id: updatedTask.original_task_id || updatedTask.id, // Chain them
            };
            await createTask(newTask);
        }
    }

    return updatedTask;
};

export const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
    return true;
};
