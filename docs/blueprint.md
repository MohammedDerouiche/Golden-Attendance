# **App Name**: GoldenClock

## Core Features:

- Top Navigation Bar: Top navigation bar: includes the app logo/name, user dropdown (select user + Add new user option) showing currently selected user and role, and a 'Clear selection' button.
- Clock In/Out: Clock In / Clock Out buttons: Prominent buttons on the main page. Each click saves an attendance record for the selected user with current time (UTC). Shows last action and last action time for the selected user. Includes geolocation capturing.
- User Management: User Management: Add New User modal and inline form (React Hook Form + Zod). Form includes fields for name, phone, role, optional position, and optional hourly_rate. Provides feedback messages upon completion
- History Display: History Page: Display attendance logs for the selected user. Table columns include date/time (local), action (in/out), location (if any). Includes date range filter (start / end). If selected user is admin, ability to choose any user from a small dropdown to view their logs.
- User Context: Selected User Context: React Context exposes user, setUser, clearUser and persists to local storage.
- Data Persistence: Supabase Integration: /services modules with clean Supabase query functions.

## Style Guidelines:

- Primary color: Deep blue (#1E3A8A) to evoke a sense of trust, reliability, and professionalism.
- Background color: Light blue (#F0F9FF), offering a clean and unobtrusive backdrop that ensures readability and minimizes distractions.
- Accent color: Violet (#7C3AED), a sophisticated touch, helping to highlight key interactive elements, such as call-to-action buttons, or other important UI components.
- Headline font: 'Poppins' (sans-serif) for a contemporary, precise feel, for headlines.
- Body font: 'PT Sans' (sans-serif) combines a modern look with a little warmth or personality.
- Code font: 'Source Code Pro' (monospace) for displaying code snippets.
- Simple line icons to represent actions like 'Clock In' and 'Clock Out', ensuring clarity and ease of understanding.
- A clean and well-spaced layout that prioritizes clarity, easy navigation, and user accessibility.