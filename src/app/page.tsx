'use client';

import { useSelectedUser } from '@/hooks/useSelectedUser';
import Clock from '@/components/Clock';
import LiveClock from '@/components/LiveClock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const { selectedUser, isLoading } = useSelectedUser();
  
  return (
    <div className="container mx-auto p-4 md:p-8 flex-grow flex flex-col items-center justify-center">
      <LiveClock />
      {isLoading ? (
        <div className="w-full max-w-md">
          <Skeleton className="h-12 w-3/4 mx-auto mb-4" />
          <Skeleton className="h-8 w-1/2 mx-auto" />
        </div>
      ) : selectedUser ? (
        <Clock />
      ) : (
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary">Welcome to GoldenClock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please select or add a user from the dropdown in the top-right corner to begin.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
