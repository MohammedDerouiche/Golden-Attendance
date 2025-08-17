
'use client';

import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { getTasks } from '@/lib/supabase/api';
import TaskList from '@/components/tasks/TaskList';
import TaskListTable from '@/components/tasks/TaskListTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import TaskForm from '@/components/tasks/TaskForm';
import { PlusCircle, Filter, Calendar as CalendarIcon, X, LayoutGrid, List } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '@/lib/supabase/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TasksPage() {
    const { selectedUser, users, isLoading: isUserLoading } = useSelectedUser();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

    const [filters, setFilters] = useState({
        status: undefined as TaskStatus | undefined,
        priority: undefined as TaskPriority | undefined,
        assignedTo: undefined as string | undefined
    });
    const [dateFilter, setDateFilter] = useState<Date | undefined>(new Date());

    const swrKey = useMemo(() => (
        selectedUser ? ['tasks', selectedUser.id, selectedUser.role, filters, dateFilter] : null
    ), [selectedUser, filters, dateFilter]);

    const { data: tasks, error, isLoading: isLoadingTasks, mutate } = useSWR(swrKey, 
        () => getTasks(selectedUser!.id, selectedUser!.role === 'admin', filters, dateFilter)
    );

    const handleFormOpen = (task: Task | null) => {
        setEditingTask(task);
        setIsFormOpen(true);
    };

    const handleFormClose = () => {
        setEditingTask(null);
        setIsFormOpen(false);
        mutate(); // Refresh the tasks list
    };

    const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value === 'all' ? undefined : value }));
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
                <p className="text-muted-foreground">Please select a user to continue.</p>
              </CardContent>
            </Card>
           </div>
        );
    }

    const isLoading = isUserLoading || isLoadingTasks;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <h1 className="text-3xl font-headline font-bold text-primary">Task Management</h1>
                <div className="flex items-center gap-2">
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'card' | 'list')}>
                        <TabsList>
                            <TabsTrigger value="card"><LayoutGrid className="mr-2 h-4 w-4" /> Cards</TabsTrigger>
                            <TabsTrigger value="list"><List className="mr-2 h-4 w-4" /> List</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button onClick={() => handleFormOpen(null)} size="lg">
                        <PlusCircle className="mr-2 h-5 w-5" />
                        New Task
                    </Button>
                </div>
            </div>
            
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Filter className="h-5 w-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select onValueChange={(v) => handleFilterChange('status', v)} defaultValue="all">
                            <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="not_started">Not Started</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1.5">
                        <Label>Priority</Label>
                        <Select onValueChange={(v) => handleFilterChange('priority', v)} defaultValue="all">
                            <SelectTrigger><SelectValue placeholder="Filter by priority" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priorities</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1.5">
                        <Label>Assigned To</Label>
                        <Select onValueChange={(v) => handleFilterChange('assignedTo', v)} defaultValue="all">
                            <SelectTrigger><SelectValue placeholder="Filter by user" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1.5">
                        <Label>Due Date</Label>
                         <div className="relative">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !dateFilter && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateFilter ? format(dateFilter, "PPP") : <span>All Dates</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={dateFilter}
                                    onSelect={setDateFilter}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                            {dateFilter && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 absolute right-1 top-1/2 -translate-y-1/2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDateFilter(undefined);
                                    }}
                                >
                                    <X className="h-4 w-4"/>
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                 <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : error ? (
                <p className="text-destructive text-center">Failed to load tasks.</p>
            ) : viewMode === 'card' ? (
                <TaskList
                    tasks={tasks || []}
                    onEdit={handleFormOpen}
                    onDelete={mutate}
                    onStatusChange={mutate}
                />
            ) : (
                 <TaskListTable
                    tasks={tasks || []}
                    onEdit={handleFormOpen}
                    onDelete={mutate}
                    onStatusChange={mutate}
                />
            )}

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                    </DialogHeader>
                    <TaskForm
                        task={editingTask}
                        onFinished={handleFormClose}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
