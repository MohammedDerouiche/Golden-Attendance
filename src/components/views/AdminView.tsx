
'use client';

import { useSelectedUser } from '@/hooks/useSelectedUser';
import UsersTable from '@/components/UsersTable';
import AdminGuard from '../AdminGuard';
import Link from 'next/link';
import { Button } from '../ui/button';

export default function AdminView() {
  const { selectedUser } = useSelectedUser();

  return (
    <AdminGuard>
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-headline font-bold text-primary">User Management</h1>
          {/* This button could link to an "Add User" form/modal */}
        </div>
        <UsersTable />
      </div>
    </AdminGuard>
  );
}
