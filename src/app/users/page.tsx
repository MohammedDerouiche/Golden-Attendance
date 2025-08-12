'use client';

import AdminGuard from '@/components/AdminGuard';
import UsersTable from '@/components/UsersTable';

export default function UsersPage() {
  return (
    <AdminGuard>
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-headline font-bold mb-6 text-primary">User Management</h1>
        <UsersTable />
      </div>
    </AdminGuard>
  );
}
