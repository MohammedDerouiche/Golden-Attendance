
import type { User } from ".";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AttendanceStatus = 'present' | 'absent' | 'day_off';

export interface Database {
  public: {
    Tables: {
      attendance: {
        Row: {
          id: string
          user_id: string
          action: 'in' | 'out'
          time: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          created_at: string
          status: AttendanceStatus
          paid_hours: number | null
        }
        Insert: {
          id?: string
          user_id: string
          action: 'in' | 'out'
          time: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          status?: AttendanceStatus
          paid_hours?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          action?: 'in' | 'out'
          time?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          status?: AttendanceStatus
          paid_hours?: number | null
        }
      }
      users: {
        Row: {
          id: string
          name: string
          phone: string | null
          role: 'admin' | 'employee'
          position: string | null
          hourly_rate: number | null
          created_at: string
          daily_target_hours: number
          password: string | null
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          role: 'admin' | 'employee'
          position?: string | null
          hourly_rate?: number | null
          daily_target_hours?: number
          password?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          role?: 'admin' | 'employee'
          position?: string | null
          hourly_rate?: number | null
          daily_target_hours?: number
          password?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
        get_active_employees: {
            Args: Record<string, unknown>;
            Returns: {
                user_id: string;
                name: string;
                clock_in_time: string;
                latitude: number | null;
                longitude: number | null;
            }[];
        }
        get_top_employees_by_hours: {
            Args: {
                start_date: string;
                end_date: string;
            };
            Returns: {
                name: string;
                total_hours: number;
            }[];
        }
        mark_day_off_for_user: {
            Args: {
                p_user_id: string;
                p_paid_hours: number;
            };
            Returns: void;
        }
        mark_absent_for_user: {
            Args: {
                p_user_id: string;
            };
            Returns: void;
        }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// SQL to create the get_active_employees function:
/*
CREATE OR REPLACE FUNCTION get_active_employees()
RETURNS TABLE(
    user_id UUID,
    name TEXT,
    clock_in_time TIMESTAMPTZ,
    latitude REAL,
    longitude REAL
) AS $$
BEGIN
    RETURN QUERY
    WITH last_attendance AS (
        SELECT
            att.user_id,
            att.action,
            att.time,
            att.latitude,
            att.longitude,
            ROW_NUMBER() OVER(PARTITION BY att.user_id ORDER BY att.time DESC) as rn
        FROM
            public.attendance att
    )
    SELECT
        u.id,
        u.name,
        la.time,
        la.latitude,
        la.longitude
    FROM
        last_attendance la
    JOIN
        public.users u ON la.user_id = u.id
    WHERE
        la.rn = 1 AND la.action = 'in';
END;
$$ LANGUAGE plpgsql;
*/

// SQL to create the get_top_employees_by_hours function:
/*
CREATE OR REPLACE FUNCTION public.get_top_employees_by_hours(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(name text, total_hours numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH valid_pairs AS (
        SELECT
            user_id,
            time AS in_time,
            LEAD(time) OVER (PARTITION BY user_id, date_trunc('day', time) ORDER BY time) AS out_time,
            action,
            LEAD(action) OVER (PARTITION BY user_id, date_trunc('day', time) ORDER BY time) AS next_action
        FROM
            public.attendance
        WHERE
            status = 'present' AND time >= start_date AND time <= end_date
    ),
    present_hours AS (
        SELECT
            user_id,
            SUM(EXTRACT(EPOCH FROM (out_time - in_time))) / 3600.0 AS hours
        FROM
            valid_pairs
        WHERE
            action = 'in' AND next_action = 'out'
        GROUP BY
            user_id
    ),
    day_off_hours AS (
        SELECT
            user_id,
            SUM(COALESCE(paid_hours, 0)) AS hours
        FROM
            public.attendance
        WHERE
            status = 'day_off' AND time >= start_date AND time <= end_date
        GROUP BY
            user_id
    ),
    total_hours_per_user AS (
        SELECT
            u.id as user_id,
            COALESCE(ph.hours, 0) + COALESCE(doh.hours, 0) as total_hours
        FROM
            public.users u
        LEFT JOIN present_hours ph ON u.id = ph.user_id
        LEFT JOIN day_off_hours doh ON u.id = doh.user_id
    )
    SELECT
        u.name,
        th.total_hours
    FROM
        total_hours_per_user th
    JOIN
        public.users u ON th.user_id = u.id
    WHERE
        th.total_hours > 0
    ORDER BY
        th.total_hours DESC
    LIMIT 5;
END;
$function$;
*/


export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];
export type Attendance = Database['public']['Tables']['attendance']['Row'];
export type AttendanceInsert = Database['public']['Tables']['attendance']['Insert'];
export type AttendanceUpdate = Database['public']['Tables']['attendance']['Update'];
export type ActiveEmployee = Database['public']['Functions']['get_active_employees']['Returns'][number];
export type TopEmployee = Database['public']['Functions']['get_top_employees_by_hours']['Returns'][number];
