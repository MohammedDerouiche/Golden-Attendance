'use client';

import { useSelectedUser } from '@/hooks/useSelectedUser';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { selectedUser, isLoading } = useSelectedUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!selectedUser || selectedUser.role !== 'admin')) {
      router.replace('/');
    }
  }, [selectedUser, isLoading, router]);
  
  if (isLoading || !selectedUser || selectedUser.role !== 'admin') {
    return (
        <div className="container mx-auto p-4 md:p-8 flex-grow flex items-center justify-center">
            <div className="w-full max-w-md space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
            </div>
        </div>
    );
  }

  return <>{children}</>;
}
