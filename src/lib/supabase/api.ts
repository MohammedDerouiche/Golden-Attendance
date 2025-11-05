

import { supabase } from './client';
import type { UserInsert, UserUpdate, AttendanceInsert, AttendanceUpdate, Attendance, ActiveEmployee, Task, TaskInsert, TaskUpdate, TaskStatus, TaskPriority, TaskRecurrence, User, TaskGroup, PenaltySetting } from './types';
import { startOfDay, endOfDay, addDays, addWeeks, addMonths, startOfMonth, endOfMonth, isFriday, eachDayOfInterval as fnsEachDayOfInterval } from 'date-fns';
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
    .select('*, replacement:replacement_user_id(id, name)')
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
  return data as any;
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
        .select('*_')
        .eq('user_id', userId)
        .gte('time', monthStart.toISOString())
        .lte('time', monthEnd.toISOString())
        .order('time', { ascending: true });
    
    if (error) throw error;
    return data;
};


export const getAttendanceById = async (id: string) => {
    const { data, error } = await supabase.from('attendance').select('*_').eq('id', id).single();
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
        .select('*_')
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

export const markAsDayOff = async (userId: string, paidHours: number, replacementUserId?: string | null) => {
    const { error } = await supabase.rpc('mark_day_off_for_user', {
        p_user_id: userId,
        p_paid_hours: paidHours,
        p_replacement_user_id: replacementUserId,
    });
    if (error) throw error;
    return true;
};

export const markAsAbsent = async (userId: string, replacementUserId?: string | null) => {
    const { error } = await supabase.rpc('mark_absent_for_user', {
        p_user_id: userId,
        p_replacement_user_id: replacementUserId,
    });
    if (error) throw error;
    return true;
};

export const createOrUpdateManualRecord = async (
    { recordId, userId, time, status, notes, paidHours, replacementUserId }: 
    { recordId?: string | null, userId: string, time: Date, status: string, notes?: string | null, paidHours?: number | null, replacementUserId?: string | null }
) => {
    let submission: AttendanceInsert | AttendanceUpdate = {
        user_id: userId,
        time: time.toISOString(),
        notes: notes,
        replacement_user_id: replacementUserId,
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
    userId: string | null,
    isAdmin: boolean,
    filters: { status?: TaskStatus, priority?: TaskPriority, assignedTo?: string, groupId?: string },
    dateRange?: DateRange | undefined
): Promise<Task[]> => {
    // Handle the dateRange logic safely
    const date_from = dateRange?.from ? startOfDay(dateRange.from).toISOString() : null;
    const date_to = dateRange?.to ? endOfDay(dateRange.to).toISOString() : null;

    const { data: rpcData, error } = await supabase.rpc('get_tasks_for_view', {
        p_user_id: userId,
        p_is_admin: isAdmin,
        p_status: filters.status || null,
        p_priority: filters.priority || null,
        p_assigned_to_filter: filters.assignedTo || null,
        p_group_id: filters.groupId || null,
        p_date_from: date_from,
        p_date_to: date_to,
    });
    
    if (error) {
        console.error("Error fetching tasks from RPC:", error);
        throw error;
    }

    const userIds = new Set<string>();
    const groupIds = new Set<string>();

    rpcData.forEach(task => {
        if (task.created_by) userIds.add(task.created_by);
        if (task.assigned_to) userIds.add(task.assigned_to);
        if (task.original_assignee_id) userIds.add(task.original_assignee_id);
        if (task.group_id) groupIds.add(task.group_id);
    });

    // Proceed with fetching users and groups only if there are IDs to fetch
    const usersPromise = userIds.size > 0 
        ? supabase.from('users').select('id, name').in('id', Array.from(userIds))
        : Promise.resolve({ data: [], error: null });

    const groupsPromise = groupIds.size > 0
        ? supabase.from('task_groups').select('id, name').in('id', Array.from(groupIds))
        : Promise.resolve({ data: [], error: null });

    const [
        { data: users, error: userError },
        { data: groups, error: groupError }
    ] = await Promise.all([usersPromise, groupsPromise]);

    if (userError) throw userError;
    if (groupError) throw groupError;

    const userMap = new Map((users || []).map(u => [u.id, u]));
    const groupMap = new Map((groups || []).map(g => [g.id, g]));

    const enrichedTasks: Task[] = rpcData.map(task => ({
        ...(task as any), // Cast to any to handle the initial rpc data shape
        status: task.status as TaskStatus,
        priority: task.priority as TaskPriority,
        recurrence_type: task.recurrence_type as TaskRecurrence,
        allow_delay: task.allow_delay,
        users_created_by: task.created_by ? userMap.get(task.created_by) || null : null,
        assigned_to: task.assigned_to ? userMap.get(task.assigned_to) || null : null,
        original_assignee: task.original_assignee_id ? userMap.get(task.original_assignee_id) || null : null,
        task_groups: task.group_id ? groupMap.get(task.group_id) || null : null,
    }));

    return enrichedTasks;
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

export const createTask = async (taskData: TaskInsert) => {
    const { assigned_to, due_date, recurrence_type, ...restOfTaskData } = taskData;

    // --- NON-RECURRING or MULTI-ASSIGN ---
    if (recurrence_type === 'none' || !recurrence_type) {
        const assignedIds = assigned_to || [];
        const tasksToInsert: Omit<Task, 'id' | 'created_at' | 'users_created_by' | 'assigned_to' | 'original_assignee' | 'task_groups'>[] = [];

        if (assignedIds.length > 0) {
            assignedIds.forEach(userId => {
                tasksToInsert.push({ 
                    ...restOfTaskData, 
                    due_date: due_date ?? null,
                    assigned_to: userId,
                    image_urls: restOfTaskData.image_urls ? [...restOfTaskData.image_urls] : null, // Create a copy
                });
            });
        } else {
            // Unassigned task
            tasksToInsert.push({ ...restOfTaskData, due_date: due_date ?? null, assigned_to: null, image_urls: restOfTaskData.image_urls ? [...restOfTaskData.image_urls] : null });
        }

        const { data, error } = await supabase.from('tasks').insert(tasksToInsert).select();
        if (error) throw error;
        return data;
    }

    // --- RECURRING TASK LOGIC ---
    const tasksToInsert: Omit<Task, 'id' | 'created_at' | 'users_created_by' | 'assigned_to' | 'original_assignee' | 'task_groups'>[] = [];
    const assignedId = assigned_to?.[0] || null; // Recurring tasks are assigned to one user
    const endDate = due_date ? endOfDay(new Date(due_date)) : null;

    if (!endDate) {
        // If no end date, just create one task
        const { data, error } = await supabase.from('tasks').insert({ ...taskData, assigned_to: assignedId, image_urls: taskData.image_urls ? [...taskData.image_urls] : null }).select();
        if (error) throw error;
        return data;
    }
    
    // Create the "master" task to get an original_task_id
    const { data: masterTask, error: masterError } = await supabase
        .from('tasks')
        .insert({
            ...restOfTaskData,
            recurrence_type,
            assigned_to: assignedId,
            due_date: due_date,
        })
        .select()
        .single();
    
    if (masterError) throw masterError;
    const originalId = masterTask.id;
    
    let currentDate = startOfDay(new Date());

    while (currentDate <= endDate) {
        tasksToInsert.push({
            ...restOfTaskData,
            title: taskData.title,
            due_date: currentDate.toISOString(),
            assigned_to: assignedId,
            recurrence_type,
            original_task_id: originalId,
            image_urls: restOfTaskData.image_urls ? [...restOfTaskData.image_urls] : null, // Create a copy
        });
        currentDate = getNextDueDate(currentDate, recurrence_type, restOfTaskData.recurrence_interval) || addDays(endDate, 1); // Failsafe
    }
    
    if (tasksToInsert.length > 0) {
        const { error: batchError } = await supabase.from('tasks').insert(tasksToInsert);
        if (batchError) {
             await supabase.from('tasks').delete().eq('id', originalId); // Clean up master task on failure
             throw batchError;
        }
    }
    
    // We can delete the master task as it's just a template now
    await supabase.from('tasks').delete().eq('id', originalId);

    return []; // Return value might need adjustment based on what the UI needs
};


export const updateTask = async (taskId: string, taskData: TaskUpdate) => {
    const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskId)
        .select(`*, task_groups(id, name)`)
        .single();

    if (error) throw error;

    // Handle recurring task creation
    const shouldCreateNext = updatedTask.status === 'completed' || updatedTask.status === 'undone';

    if (shouldCreateNext && updatedTask.recurrence_type && updatedTask.recurrence_type !== 'none' && updatedTask.original_task_id) {
        
        // Find the "master" due date from the original task to continue the series
        const { data: originalTask } = await supabase.from('tasks').select('due_date').eq('id', updatedTask.original_task_id).single();
        const seriesEndDate = originalTask?.due_date ? new Date(originalTask.due_date) : null;
        
        const currentDueDate = updatedTask.due_date ? new Date(updatedTask.due_date) : new Date();
        const nextDueDate = getNextDueDate(currentDueDate, updatedTask.recurrence_type, updatedTask.recurrence_interval);

        if (nextDueDate && seriesEndDate && nextDueDate <= seriesEndDate) {
            const newTask: TaskInsert = {
                title: updatedTask.title,
                description: updatedTask.description,
                status: 'not_started',
                priority: updatedTask.priority,
                due_date: nextDueDate.toISOString(),
                created_by: updatedTask.created_by,
                assigned_to: updatedTask.assigned_to ? [updatedTask.assigned_to] : [],
                recurrence_type: updatedTask.recurrence_type,
                recurrence_interval: updatedTask.recurrence_interval,
                original_task_id: updatedTask.original_task_id,
                group_id: updatedTask.group_id,
                image_urls: updatedTask.image_urls,
                allow_delay: updatedTask.allow_delay,
            };

            await supabase.from('tasks').insert(newTask);
        }
    }

    return updatedTask;
};

export const deleteTask = async (taskId: string) => {
    // First, get the image URLs for the task being deleted.
    const { data: taskData, error: fetchError } = await supabase
      .from('tasks')
      .select('image_urls')
      .eq('id', taskId)
      .single();
  
    if (fetchError && fetchError.code !== 'PGRST116') { // Ignore "single row not found" error
      console.error('Error fetching task for deletion:', fetchError);
      throw fetchError;
    }
  
    // Now, delete the task itself.
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId);
    if (deleteError) {
      console.error('Error deleting task:', deleteError);
      throw deleteError;
    }
  
    // If the task had images, check if they are used elsewhere before deleting from storage.
    if (taskData?.image_urls && taskData.image_urls.length > 0) {
      for (const imageUrl of taskData.image_urls) {
        // Check if any other task uses this image URL.
        const { count, error: countError } = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .contains('image_urls', [imageUrl]);
  
        if (countError) {
          console.error(`Error checking image usage for ${imageUrl}:`, countError);
          continue;
        }
  
        if (count === 0) {
          try {
            await deleteTaskImage(imageUrl);
          } catch (storageError) {
            console.error(`Failed to delete image ${imageUrl} from storage:`, storageError);
          }
        }
      }
    }
  
    return true;
  };

// Task Group Functions
export const getTaskGroups = async (): Promise<TaskGroup[]> => {
    const { data, error } = await supabase.from('task_groups').select('*_').order('name');
    if (error) throw error;
    return data;
};

export const createTaskGroup = async (name: string): Promise<TaskGroup> => {
    const { data, error } = await supabase.from('task_groups').insert({ name }).select().single();
    if (error) throw error;
    return data;
};

// Storage Functions
export const uploadTaskImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('task_images').upload(filePath, file);

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage.from('task_images').getPublicUrl(filePath);

    return data.publicUrl;
};

export const deleteTaskImage = async (imageUrl: string): Promise<void> => {
    try {
      const url = new URL(imageUrl);
      const bucketName = 'task_images';
      const pathPrefix = `/storage/v1/object/public/${bucketName}/`;
  
      // Ensure pathname uses the expected prefix
      if (!url.pathname.startsWith(pathPrefix)) {
        throw new Error('URL does not match expected Supabase storage URL structure.');
      }
  
      // Extract and decode the file path relative to the bucket
      let filePath = url.pathname.substring(pathPrefix.length);
      // Remove leading slash if present (defensive)
      if (filePath.startsWith('/')) filePath = filePath.substring(1);
      // URL-decode in case the object name contains encoded characters
      filePath = decodeURIComponent(filePath);
  
      const { error } = await supabase.storage.from(bucketName).remove([filePath]);
  
      if (error) {
        console.error(`Supabase storage deletion error for path "${filePath}":`, error);
        throw error;
      }
    } catch (e) {
      console.error('Error parsing or deleting image from URL:', e);
      // swallow so task deletion can complete; optionally rethrow if desired
    }
  };


// Penalty Settings Functions
export const getPenaltySettings = async (): Promise<PenaltySetting[]> => {
    const { data, error } = await supabase.from('penalty_settings').select('*_');
    if (error) throw error;
    return data;
};

export const updatePenaltySettings = async (settings: PenaltySetting[]): Promise<PenaltySetting[]> => {
    const { data, error } = await supabase.from('penalty_settings').upsert(settings).select();
    if (error) throw error;
    return data;
};
