
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import HistoryTable from '@/components/HistoryTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '@/lib/supabase/types';

export default function HistoryView() {
  const { selectedUser, users, isLoading: isUserLoading } = useSelectedUser();
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedUser) {
        setViewingUserId(selectedUser.role === 'admin' ? 'all' : selectedUser.id);
    }
  }, [selectedUser]);

  const targetUserIdForApi = useMemo(() => (
    selectedUser?.role === 'admin' && viewingUserId === 'all' ? null : (viewingUserId || selectedUser?.id)
  ), [selectedUser, viewingUserId]);
  
  const viewingUser = useMemo(() => (
    users.find(u => u.id === viewingUserId) || null
  ), [users, viewingUserId]);

  const canAddNewRecord = useMemo(() => {
    if (!selectedUser) return false;
    if (selectedUser.role === 'admin') return viewingUserId !== 'all';
    return viewingUserId === selectedUser.id;
  }, [selectedUser, viewingUserId]);


  if (isUserLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <Skeleton className="h-10 w-1/2 md:w-1/4 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!selectedUser) {
    return (
       <div className="container mx-auto p-4 md:p-8 flex-grow flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please select a user to view history.</p>
          </CardContent>
        </Card>
       </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-headline font-bold mb-6 text-primary">Attendance History</h1>
      {selectedUser.role === 'admin' && (
        <div className="mb-6 max-w-sm">
          <Label htmlFor="user-select">View History For</Label>
          <Select
            onValueChange={(value) => setViewingUserId(value)}
            value={viewingUserId || ''}
          >
            <SelectTrigger id="user-select">
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <HistoryTable 
        userId={targetUserIdForApi} 
        canAddNew={canAddNewRecord} 
        viewingUser={viewingUserId === 'all' ? null : viewingUser || selectedUser}
      />
    </div>
  );
}
