
'use client';

import type { CustomerDemand } from '@/lib/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Trash2, Calendar, Phone, User, Check, Ban, RefreshCw, ShoppingCart } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { updateDemandStatus } from '@/lib/supabase/api';
import { useToast } from '@/hooks/use-toast';
import useSWR from 'swr';

interface DemandCardProps {
  demand: CustomerDemand;
  onDelete: (demand: CustomerDemand) => void;
}

const statusConfig = {
    new: { label: 'New', color: 'bg-blue-500', icon: <ShoppingCart className="h-3 w-3" /> },
    fulfilled: { label: 'Fulfilled', color: 'bg-green-500', icon: <Check className="h-3 w-3" /> },
    cancelled: { label: 'Cancelled', color: 'bg-red-500', icon: <Ban className="h-3 w-3" /> },
};


export default function DemandCard({ demand, onDelete }: DemandCardProps) {
    const { selectedUser } = useSelectedUser();
    const { toast } = useToast();
    // We need to re-fetch demands when status changes. mutate is on the parent page.
    // A better way is to use the global mutate function from SWR.
    const { mutate } = useSWRConfig();
    
    const canModify = selectedUser?.role === 'admin' || selectedUser?.id === demand.created_by;
    const currentStatus = statusConfig[demand.status as keyof typeof statusConfig];

    const handleStatusChange = async (newStatus: 'new' | 'fulfilled' | 'cancelled') => {
        try {
            await updateDemandStatus(demand.id, newStatus);
            toast({ title: 'Status Updated', description: `Demand status changed to ${newStatus}.`});
            // This will trigger a re-fetch for any SWR key that includes 'demands'
            mutate((key) => Array.isArray(key) && key.includes('demands'), undefined, { revalidate: true });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error updating status', description: error.message });
        }
    }

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-1.5">
                         <Badge variant="secondary" className={cn("text-white", currentStatus.color)}>
                            {currentStatus.icon} {currentStatus.label}
                        </Badge>
                        <CardTitle className="text-lg line-clamp-2">{demand.product_description}</CardTitle>
                        <CardDescription>
                            {demand.category ? `Category: ${demand.category.name}` : ''}
                        </CardDescription>
                         <CardDescription>
                            Created {formatDistanceToNow(new Date(demand.created_at), { addSuffix: true })} by {demand.created_by_user?.name || 'Unknown'}
                        </CardDescription>
                    </div>
                    {canModify && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onDelete(demand)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 {demand.image_url && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-md">
                        <Image src={demand.image_url} alt="Product image" fill className="object-cover" />
                    </div>
                )}
                <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Customer: <span className="font-medium text-foreground">{demand.customer_name}</span></span>
                    </div>
                    {demand.customer_phone && (
                         <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{demand.customer_phone}</span>
                        </div>
                    )}
                    {demand.desired_date && (
                         <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Needed by: {format(new Date(demand.desired_date), 'PPP')}</span>
                        </div>
                    )}
                </div>
            </CardContent>
             {canModify && (
                <CardFooter className="flex flex-col sm:flex-row gap-2">
                    {demand.status === 'new' && (
                        <>
                             <Button variant="outline" size="sm" className="w-full" onClick={() => handleStatusChange('cancelled')}>
                                <Ban className="mr-2 h-4 w-4" /> Cancel
                            </Button>
                            <Button size="sm" className="w-full" onClick={() => handleStatusChange('fulfilled')}>
                                <Check className="mr-2 h-4 w-4" /> Mark as Fulfilled
                            </Button>
                        </>
                    )}
                     {(demand.status === 'fulfilled' || demand.status === 'cancelled') && (
                        <Button variant="outline" size="sm" className="w-full" onClick={() => handleStatusChange('new')}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Re-open Demand
                        </Button>
                    )}
                </CardFooter>
            )}
        </Card>
    );
}

// We need to import useSWRConfig to get the global mutate function
import { useSWRConfig } from 'swr';
