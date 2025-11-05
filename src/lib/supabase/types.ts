

import type { User } from ".";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AttendanceStatus = 'present' | 'absent' | 'day_off';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'undone';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom_days';
export type DemandStatus = 'new' | 'fulfilled' | 'cancelled';

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
          replacement_user_id: string | null
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
          replacement_user_id?: string | null
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
          replacement_user_id?: string | null
        }
      }
      users: {
        Row: {
          id: string
          name: string
          phone: string | null
          role: 'admin' | 'employee'
          position: string | null
          monthly_salary: number | null
          created_at: string
          daily_target_hours: number
          friday_target_hours: number | null
          password: string | null
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          role: 'admin' | 'employee'
          position?: string | null
          monthly_salary?: number | null
          daily_target_hours?: number
          friday_target_hours?: number | null
          password?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          role?: 'admin' | 'employee'
          position?: string | null
          monthly_salary?: number | null
          daily_target_hours?: number
          friday_target_hours?: number | null
          password?: string | null
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: TaskStatus
          priority: TaskPriority
          due_date: string | null
          created_at: string
          created_by: string
          assigned_to: string | null
          recurrence_type: TaskRecurrence
          recurrence_interval: number | null
          original_task_id: string | null
          group_id: string | null
          image_urls: string[] | null
          original_assignee_id: string | null
          allow_delay: boolean
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          due_date?: string | null
          created_by: string
          assigned_to?: string[] | null // For multi-insert logic
          recurrence_type?: TaskRecurrence
          recurrence_interval?: number | null
          original_task_id?: string | null
          group_id?: string | null
          image_urls?: string[] | null
          original_assignee_id?: string | null
          allow_delay?: boolean
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          due_date?: string | null
          created_by?: string
          assigned_to?: string | null
          recurrence_type?: TaskRecurrence
          recurrence_interval?: number | null
          original_task_id?: string | null
          group_id?: string | null
          image_urls?: string[] | null
          original_assignee_id?: string | null
          allow_delay?: boolean
        }
      }
      task_groups: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      penalty_settings: {
        Row: {
            priority: string;
            amount: number;
        };
        Insert: {
            priority: string;
            amount: number;
        };
        Update: {
            priority?: string;
            amount?: number;
        };
      }
      customer_demands: {
        Row: {
          id: string;
          customer_name: string;
          customer_phone: string | null;
          product_description: string;
          desired_date: string | null;
          image_url: string | null;
          status: DemandStatus;
          category_id: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          customer_phone?: string | null;
          product_description: string;
          desired_date?: string | null;
          image_url?: string | null;
          status?: DemandStatus;
          category_id?: string | null;
          created_by: string;
        };
        Update: {
          status?: DemandStatus;
        };
      };
      demand_categories: {
          Row: {
              id: string;
              name: string;
              created_at: string;
          };
          Insert: {
              id?: string;
              name: string;
          };
          Update: {
              name?: string;
          }
      };
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
        mark_overdue_tasks_as_undone: {
            Args: Record<string, unknown>;
            Returns: void;
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
                p_notes?: string;
                p_replacement_user_id?: string;
            };
            Returns: void;
        }
        mark_absent_for_user: {
            Args: {
                p_user_id: string;
                p_notes?: string;
                p_replacement_user_id?: string;
            };
            Returns: void;
        }
        get_tasks_for_view: {
            Args: {
                p_user_id: string | null;
                p_is_admin: boolean;
                p_status: string | null;
                p_priority: string | null;
                p_assigned_to_filter: string | null;
                p_group_id: string | null;
                p_date_from: string | null;
                p_date_to: string | null;
            };
            Returns: {
                id: string;
                title: string;
                description: string | null;
                status: string;
                priority: string;
                due_date: string | null;
                created_at: string;
                created_by: string;
                assigned_to: string | null;
                recurrence_type: string;
                recurrence_interval: number | null;
                original_task_id: string | null;
                group_id: string | null;
                image_urls: string[] | null;
                allow_delay: boolean;
                original_assignee_id: string | null;
            }[];
        }
        delete_demand_and_image: {
            Args: {
                demand_id_to_delete: string;
            };
            Returns: void;
        };
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];
export type Attendance = Database['public']['Tables']['attendance']['Row'] & { replacement?: Pick<User, 'id' | 'name'> };
export type AttendanceInsert = Database['public']['Tables']['attendance']['Insert'];
export type AttendanceUpdate = Database['public']['Tables']['attendance']['Update'];
export type ActiveEmployee = Database['public']['Functions']['get_active_employees']['Returns'][number];
export type TopEmployee = Database['public']['Functions']['get_top_employees_by_hours']['Returns'][number];

export type TaskGroup = Database['public']['Tables']['task_groups']['Row'];

export type Task = Omit<Database['public']['Tables']['tasks']['Row'], 'status' | 'priority' | 'recurrence_type'> & {
    status: TaskStatus;
    priority: TaskPriority;
    recurrence_type: TaskRecurrence;
    users_created_by: Pick<User, 'id' | 'name'> | null;
    assigned_to: Pick<User, 'id' | 'name'> | null;
    original_assignee: Pick<User, 'id' | 'name'> | null;
    task_groups: Pick<TaskGroup, 'id' | 'name'> | null;
};
export type TaskInsert = Omit<Database['public']['Tables']['tasks']['Insert'], 'assigned_to'> & {
    assigned_to?: string[] | null;
};
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export type PenaltySetting = Database['public']['Tables']['penalty_settings']['Row'];

export type DemandCategory = Database['public']['Tables']['demand_categories']['Row'];
export type CustomerDemand = Database['public']['Tables']['customer_demands']['Row'] & {
    created_by_user: Pick<User, 'id' | 'name'> | null;
    category: Pick<DemandCategory, 'id' | 'name'> | null;
};
export type CustomerDemandInsert = Database['public']['Tables']['customer_demands']['Insert'];
