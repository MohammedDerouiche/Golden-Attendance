
'use client';

import { useSelectedUser } from '@/hooks/useSelectedUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function TasksPage() {
    const { selectedUser, isLoading } = useSelectedUser();

    if (isLoading) {
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
                <p className="text-muted-foreground">Please select a user to continue.</p>
              </CardContent>
            </Card>
           </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            {/* Page content removed */}
        </div>
    );
}
