
'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { getDemands, deleteDemand, getDemandCategories } from '@/lib/supabase/api';
import type { CustomerDemand, DemandCategory } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DemandForm from '@/components/demands/DemandForm';
import DemandCard from '@/components/demands/DemandCard';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type StatusFilter = 'all' | 'new' | 'fulfilled' | 'cancelled';

export default function DemandsPage() {
    const { selectedUser, isLoading: isUserLoading } = useSelectedUser();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [demandToDelete, setDemandToDelete] = useState<CustomerDemand | null>(null);

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    const { toast } = useToast();

    const { data: demands, error, isLoading: isLoadingDemands, mutate } = useSWR(
        ['demands', statusFilter, categoryFilter],
        () => getDemands(statusFilter, categoryFilter),
        { revalidateOnFocus: true }
    );
     const { data: categories, isLoading: isLoadingCategories } = useSWR('demand_categories', getDemandCategories);

    const handleFormFinished = () => {
        setIsFormOpen(false);
        mutate();
    };

    const handleDeleteDemand = async () => {
        if (!demandToDelete) return;
        try {
            await deleteDemand(demandToDelete.id);
            toast({ title: 'Demand Deleted', description: 'The customer demand has been successfully removed.' });
            mutate();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error Deleting Demand',
                description: error.message,
            });
        } finally {
            setDemandToDelete(null);
        }
    };

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
                <p className="text-muted-foreground">Please select a user to manage demands.</p>
              </CardContent>
            </Card>
           </div>
        );
    }

    const isLoading = isLoadingDemands || isLoadingCategories;

    return (
        <>
            <div className="container mx-auto p-4 md:p-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                    <h1 className="text-3xl font-headline font-bold text-primary">Customer Demands</h1>
                    <Button onClick={() => setIsFormOpen(true)} size="lg">
                        <PlusCircle className="mr-2 h-5 w-5" />
                        New Demand
                    </Button>
                </div>
                
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Filter className="h-5 w-5" />
                            Filters
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select onValueChange={(v) => setStatusFilter(v as StatusFilter)} value={statusFilter}>
                                <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="new">New</SelectItem>
                                    <SelectItem value="fulfilled">Fulfilled</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Category</Label>
                            <Select onValueChange={setCategoryFilter} value={categoryFilter}>
                                <SelectTrigger><SelectValue placeholder="Filter by category" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories?.map((cat: DemandCategory) => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                    </div>
                ) : error ? (
                    <p className="text-destructive text-center">Failed to load demands.</p>
                ) : demands?.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <h3 className="text-xl font-semibold">No Demands Found</h3>
                        <p className="text-muted-foreground">Try adjusting your filters or create a new demand.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {demands?.map(demand => (
                            <DemandCard key={demand.id} demand={demand} onDelete={setDemandToDelete} />
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-[600px] grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>Create New Demand</DialogTitle>
                    </DialogHeader>
                    <div className="overflow-y-auto px-6">
                        <DemandForm onFinished={handleFormFinished} />
                    </div>
                </DialogContent>
            </Dialog>

             <AlertDialog open={!!demandToDelete} onOpenChange={(isOpen) => !isOpen && setDemandToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this demand and its associated image from storage.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteDemand} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

