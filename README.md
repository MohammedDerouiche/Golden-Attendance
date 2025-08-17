# GoldenClock: Advanced Time & Task Management App

GoldenClock is a comprehensive, feature-rich Time and Task Management web application. It serves as an advanced boilerplate and a practical demonstration of building a modern, data-driven application using a powerful, serverless tech stack.

The project is built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase**, showcasing best practices in web development, including role-based access control, real-time data handling, and complex state management.

**Important Note:** This application uses a simplified, selector-based user switching mechanism for demonstration purposes. It is **intentionally insecure for production environments** and should be integrated with a proper authentication system (like Supabase Auth with Row-Level Security) before any real-world deployment.

## Core Technologies

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS with shadcn/ui components
- **Data Fetching & State:** SWR for real-time data synchronization and caching
- **Forms:** React Hook Form with Zod for robust validation
- **UI Components:** A rich library from shadcn/ui, including tables, dialogs, charts, and more.

## Feature-Rich Functionality

### 1. User & Access Management
- **Role-Based Permissions:** The application features a dual-role system (`admin` vs. `employee`) where the UI and available actions adapt based on the selected user's role.
- **Simplified User Switching:** No complex login is required. Users are selected from a dropdown, with their session persisted in `localStorage`.
- **Admin Verification:** Accessing an `admin` profile is protected by a simple password prompt to simulate secure context switching.
- **Full User CRUD:** Admins have complete control to create, read, update, and delete user profiles, including setting roles, positions, and monthly salaries.

### 2. Time & Attendance Tracking
- **One-Click Clock-In/Out:** A streamlined interface for employees to clock in and out with a single click.
- **Live-Updating Dashboard:** The home page features a real-time digital clock and a continuously updating timer that shows the total time worked for the current day.
- **Daily Goal Tracking:** A progress bar visualizes the employee's progress toward their daily target hours.
- **Automated Daily Earnings:** For users with a monthly salary set, the app calculates and displays their potential earnings for the day in real-time based on a dynamic monthly hourly rate.
- **Static Day Marking:** Users can mark a full day as a paid **Day-Off** or an unpaid **Absence**, which overrides any clocked hours for that day.
- **Geolocation:** Captures and stores the user's geographical location on clock-in/out events.

### 3. Advanced Task Management
- **Full Task CRUD:** Users can create, update, and delete tasks.
- **Multi-User Assignment:** Tasks can be assigned to one or more employees, making it suitable for collaborative projects.
- **Recurring Tasks:** A powerful recurrence system allows tasks to be automatically re-created upon completion. Options include:
    - Daily, Weekly, Monthly
    - Custom "Every X Days" interval
- **Flexible Views:** Switch between a visual **Card View** (Kanban-style) and a dense **List View** (Table) to manage tasks effectively.
- **Comprehensive Filtering:** Filter tasks by status, priority, assignee, and due date.
- **Status Toggling:** Quickly mark tasks as complete (or undo completion) directly from the list or card view.

### 4. Data Visualization & Analytics
The **Statistics** page offers a dashboard with insightful charts and summaries:
- **Monthly Summary:** A quick overview of total worked days, days off, and absent days.
- **Task Status Pie Chart:** Visualizes the proportion of tasks that are Not Started, In Progress, and Completed.
- **Daily Hours Bar Chart:** A bar chart showing the total hours worked for each day of the selected month.
- **Attendance Heatmap:** A calendar-style heatmap that provides a visual representation of the status (Worked, Day-Off, Absent) for each day.
- **Top Employees Chart (Admin Only):** A bar chart ranking the most active employees by total hours worked in a given month.

### 5. Reporting & History
- **Detailed Attendance Log:** The **History** page provides a paginated and searchable table of all attendance records.
- **Admin-Level History View:** Admins can view the attendance history for a single, specific employee or select "All Employees" to see a consolidated log of everyone's activity.
- **Data Export:** All filtered history and salary calculation data can be exported to an Excel (`.xlsx`) file with a single click.

### 6. Salary Calculation
- **Automated Salary Tool:** The **Salary** page allows users (primarily admins) to calculate the total salary for any employee over a custom date range. The calculation is based on a dynamic hourly rate derived from the user's monthly salary and the specific work-hour targets for that month.
- **Total Hours Calculation:** The system accurately calculates total paid hours, accounting for both clocked time and paid days-off.

## Getting Started

Follow these steps to get the project running locally.

### 1. Prerequisites

- Node.js (v18 or later)
- pnpm, npm, or yarn
- A Supabase account (free tier is sufficient)

### 2. Clone the Repository

```bash
git clone <repository-url>
cd <directory-name>
```

### 3. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 4. Supabase Setup

1.  **Create a new Supabase Project:**
    - Go to [supabase.com](https://supabase.com/) and create a new project.
    - Save your **Project URL** and **`anon` public key**.

2.  **Create Database Tables:**
    - In your Supabase project, navigate to the **SQL Editor**.
    - Run the following SQL queries to create the necessary tables and functions.

    ```sql
    -- Create the users table
    CREATE TABLE public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
        position TEXT,
        monthly_salary NUMERIC,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        daily_target_hours NUMERIC DEFAULT 8 NOT NULL,
        friday_target_hours NUMERIC,
        password TEXT
    );

    -- Create the attendance table
    CREATE TABLE public.attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        action TEXT NOT NULL CHECK (action IN ('in', 'out')),
        "time" TIMESTAMPTZ NOT NULL,
        location TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        status TEXT DEFAULT 'present'::text NOT NULL,
        paid_hours NUMERIC,
        notes TEXT
    );

    -- Create the tasks table
    CREATE TABLE public.tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        due_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        assigned_to UUID[],
        recurrence_type TEXT DEFAULT 'none' NOT NULL,
        recurrence_interval INTEGER,
        original_task_id UUID
    );

    -- Add a text search index to tasks.description for better performance
    CREATE INDEX tasks_description_idx ON public.tasks USING gin (to_tsvector('english', description));
    
    -- Create the mark_day_off_for_user function
    CREATE OR REPLACE FUNCTION public.mark_day_off_for_user(p_user_id uuid, p_paid_hours numeric)
     RETURNS void
     LANGUAGE plpgsql
    AS $function$
    DECLARE
        today_start timestamptz := date_trunc('day', now());
        today_end timestamptz := date_trunc('day', now()) + interval '1 day' - interval '1 second';
    BEGIN
        -- Delete any existing records for the user today
        DELETE FROM public.attendance
        WHERE user_id = p_user_id
          AND time >= today_start
          AND time <= today_end;
    
        -- Insert the new day-off record, using the passed-in paid hours
        INSERT INTO public.attendance (user_id, action, time, status, paid_hours, notes)
        VALUES (p_user_id, 'in', now(), 'day_off', p_paid_hours, 'Full Day-Off (Paid)');
    END;
    $function$;

    -- Create the mark_absent_for_user function
    CREATE OR REPLACE FUNCTION public.mark_absent_for_user(p_user_id uuid)
     RETURNS void
     LANGUAGE plpgsql
    AS $function$
    DECLARE
        today_start timestamptz := date_trunc('day', now());
        today_end timestamptz := date_trunc('day', now()) + interval '1 day' - interval '1 second';
    BEGIN
        -- Delete any existing records for the user today
        DELETE FROM public.attendance
        WHERE user_id = p_user_id
          AND time >= today_start
          AND time <= today_end;
    
        -- Insert the new absent record
        INSERT INTO public.attendance (user_id, action, time, status, notes)
        VALUES (p_user_id, 'in', now(), 'absent', 'Full Day - Absent');
    END;
    $function$;
    ```

3.  **Configure Row-Level Security (RLS):**
    For this demo project, the simplest approach is to create permissive policies that allow public access. **This is not secure for production.**

    - Navigate to **Authentication -> Policies** in your Supabase dashboard.
    - Create the following policies using the SQL Editor:
    ```sql
    -- Policies for users table
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public can do all on users" ON public.users FOR ALL
    USING (true)
    WITH CHECK (true);

    -- Policies for attendance table
    ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public can do all on attendance" ON public.attendance FOR ALL
    USING (true)
    WITH CHECK (true);

    -- Policies for tasks table
    ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public can do all on tasks" ON public.tasks FOR ALL
    USING (true)
    WITH CHECK (true);
    ```

### 5. Set Up Environment Variables

- Create a new file named `.env.local` in the root of the project.
- Copy the contents of `.env.local.example` into it and add your Supabase credentials.

```
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) in your browser to see the application.
