'use client';

import { useSelectedUser } from '@/hooks/useSelectedUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings as SettingsIcon } from 'lucide-react';


export default function SettingsPage() {
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
                <p className="text-muted-foreground">Please select a user to view settings.</p>
              </CardContent>
            </Card>
           </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex items-center gap-4 mb-6">
                <SettingsIcon className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-headline font-bold text-primary">Settings</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Under Construction</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">More settings will be available here in the future.</p>
                </CardContent>
            </Card>
        </div>
    );
}
