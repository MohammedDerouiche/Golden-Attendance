# GoldenClock Time Attendance App

GoldenClock is a minimal-complexity, fully functional Time Attendance web app built with Next.js, TypeScript, Tailwind CSS, and Supabase.

This application is designed as a demonstration of building a data-driven application without a traditional authentication system. Instead, it uses a selectable user profile from a shared pool, with role-based permissions controlling access to different features.

**Important Note:** This application is intentionally insecure and is not suitable for production use without implementing a proper authentication and authorization system (like Supabase Auth with Row-Level Security). It is designed to showcase UI, state management, and data interaction patterns.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS with shadcn/ui components
- **Database:** Supabase (PostgreSQL)
- **Data Fetching:** SWR
- **Forms:** React Hook Form & Zod for validation

## Core Features

- **No Authentication:** Select a user from a dropdown to get started.
- **Role-Based Access:** UI and features adapt based on whether the selected user is an 'admin' or 'employee'.
- **One-Click Clock-In/Out:** Quickly record attendance with a single click.
- **Task Management:** Create, assign, and track tasks.
- **Attendance History:** View your attendance logs with date filtering.
- **Admin Dashboard:** Admins can view attendance for any user and manage the user list.
- **Persistent State:** The selected user is remembered across page reloads using `localStorage`.

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
    - Run the following SQL queries to create the necessary tables.

    ```sql
    -- Create the users table
    CREATE TABLE public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
        position TEXT,
        hourly_rate NUMERIC,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    -- Create the attendance table
    CREATE TABLE public.attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        action TEXT NOT NULL CHECK (action IN ('in', 'out')),
        "time" TIMESTAMPTZ NOT NULL,
        location TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
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
        assigned_to UUID[]
    );

    -- Add recurrence columns to the tasks table
    ALTER TABLE public.tasks ADD COLUMN recurrence_type TEXT DEFAULT 'none' NOT NULL;
    ALTER TABLE public.tasks ADD COLUMN recurrence_interval INTEGER;
    ALTER TABLE public.tasks ADD COLUMN original_task_id UUID;
    ```

3.  **Configure Row-Level Security (RLS):**
    For this demo project, the simplest approach is to disable RLS for the tables to allow public access.

    - Navigate to **Authentication -> Policies**.
    - Find your `users`, `attendance`, and `tasks` tables.
    - If RLS is enabled, you can either disable it or create permissive policies that allow anonymous users to perform `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operations.

    **Example Permissive Policies (run in SQL Editor):**
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

## How to Use

1.  **Add a User:** Click the "Add New User" button from the user dropdown in the top-right corner. Fill out the form and create at least one `admin` and one `employee` user to test all features.
2.  **Select a User:** Choose a user from the dropdown. The application state will update.
3.  **Clock In/Out:** On the main page, use the "Clock In" and "Clock Out" buttons.
4.  **View History:** Navigate to the `/history` page to see attendance records. If you are an admin, you can view the history of other users.
5.  **Manage Users (Admin):** If you are selected as an `admin`, a `/users` page will be available in the navigation.
