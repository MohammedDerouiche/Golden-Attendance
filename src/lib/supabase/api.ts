
import { supabase } from './client';
import type { UserInsert, UserUpdate, AttendanceInsert, AttendanceUpdate, Attendance, ActiveEmployee, AttendanceStatus, TopEmployee } from './types';
import { startOfDay, endOfDay } from 'date-fns';

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
