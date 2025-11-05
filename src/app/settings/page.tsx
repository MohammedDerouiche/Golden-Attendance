
'use client';

import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings as SettingsIcon, AlertOctagon, Save } from 'lucide-react';
import { getPenaltySettings, updatePenaltySettings } from '@/lib/supabase/api';
import type { PenaltySetting, TaskPriority } from '@/lib/supabase/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import AdminGuard from '@/components/AdminGuard';

const priorityOrder: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function SettingsPage() {
    const { selectedUser, isLoading: isUserLoading } = useSelectedUser();
    const { data: penaltySettings, isLoading: isLoadingPenalties, mutate: mutatePenalties } = useSWR('penalty_settings', getPenaltySettings);
    const { toast } = useToast();

    const [settings, setSettings] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (penaltySettings) {
            const settingsMap = penaltySettings.reduce((acc, setting) => {
                acc[setting.priority] = setting.amount;
                return acc;
            }, {} as Record<string, number>);
            setSettings(settingsMap);
        }
    }, [penaltySettings]);

    const handleSettingChange = (priority: string, amount: string) => {
        const numericAmount = Number(amount);
        if (!isNaN(numericAmount)) {
            setSettings(prev => ({ ...prev, [priority]: numericAmount }));
        }
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const settingsToUpdate: PenaltySetting[] = Object.entries(settings).map(([priority, amount]) => ({
                priority,
                amount,
            }));
            await updatePenaltySettings(settingsToUpdate);
            await mutatePenalties(); // re-fetch the data to confirm it's saved
            toast({
                title: 'Settings Saved',
                description: 'Your penalty settings have been updated successfully.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error Saving Settings',
                description: error.message,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const isLoading = isUserLoading || isLoadingPenalties;

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
        <AdminGuard>
            <div className="container mx-auto p-4 md:p-8">
                <div className="flex items-center gap-4 mb-6">
                    <SettingsIcon className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-headline font-bold text-primary">Settings</h1>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><AlertOctagon /> Task Penalties</CardTitle>
                        <CardDescription>
                            Configure the penalty amount (in $) applied for each overdue task based on its priority.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         {isLoading ? (
                            <Skeleton className="h-48 w-full" />
                         ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {priorityOrder.map(priority => (
                                    <div key={priority} className="space-y-2">
                                        <Label htmlFor={`penalty-${priority}`} className="capitalize text-lg">{priority}</Label>
                                        <Input
                                            id={`penalty-${priority}`}
                                            type="number"
                                            value={settings[priority] ?? ''}
                                            onChange={(e) => handleSettingChange(priority, e.target.value)}
                                            placeholder={`Enter amount for ${priority}`}
                                            className="text-base"
                                        />
                                    </div>
                                ))}
                            </div>
                         )}

                         <div className="flex justify-end">
                            <Button onClick={handleSaveChanges} disabled={isSaving}>
                                <Save className="mr-2 h-4 w-4" />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                         </div>
                    </CardContent>
                </Card>
            </div>
        </AdminGuard>
    );
}
