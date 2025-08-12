'use client';

import { useState } from 'react';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import HistoryTable from '@/components/HistoryTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

export default function HistoryPage() {
  const { selectedUser, users, isLoading: isUserLoading } = useSelectedUser();
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const targetUserId = selectedUser?.role === 'admin' ? (viewingUserId || selectedUser.id) : selectedUser?.id;

  if (isUserLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <Skeleton className="h-10 w-1/4 mb-4" />
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
      <h1 className="text-3xl font-headline font-bold mb-6 text-primary">Attendance History</h1>
      {selectedUser.role === 'admin' && (
        <div className="mb-6 max-w-sm">
          <Label htmlFor="user-select">View History For</Label>
          <Select
            onValueChange={(value) => setViewingUserId(value)}
            defaultValue={selectedUser.id}
          >
            <SelectTrigger id="user-select">
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {targetUserId && <HistoryTable userId={targetUserId} />}
    </div>
  );
}
