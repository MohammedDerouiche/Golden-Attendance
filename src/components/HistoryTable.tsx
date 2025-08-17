
'use client';

import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { deleteAttendance, getAttendanceForUser } from '@/lib/supabase/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar as CalendarIcon, MapPin, Edit, PlusCircle, Trash2, FileDown, Search, User as UserIcon, Copy } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import type { DateRange } from 'react-day-picker';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import EditAttendanceSheet from './EditAttendanceSheet';
import type { Attendance, User } from '@/lib/supabase/types';
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
import { useToast } from '@/hooks/use-toast';
import { exportToExcel, generateFileName } from '@/lib/utils';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';

interface HistoryTableProps {
  userId: string | null;
  canAddNew: boolean;
  viewingUser: User | null;
}

export default function HistoryTable({ userId, canAddNew, viewingUser }: HistoryTableProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  const [actionFilter, setActionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebounce(searchText, 300);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Attendance | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<Attendance | null>(null);

  const { selectedUser, users } = useSelectedUser();
  const { toast } = useToast();

  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const swrKey = useMemo(() => [
      'attendance',
      userId,
      dateRange?.from,
      dateRange?.to,
      actionFilter,
      debouncedSearchText
  ], [userId, dateRange, actionFilter, debouncedSearchText]);

  const { data: attendance, error, isLoading, mutate } = useSWR(
    swrKey,
    () => getAttendanceForUser(userId, dateRange?.from, dateRange?.to, actionFilter, debouncedSearchText)
  );

  const handleExport = () => {
    if (!attendance || attendance.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There is no attendance data in the selected range to export.',
      });
      return;
    }
    
    const viewingUserName = viewingUser ? viewingUser.name : 'All_Users';

    const dataToExport = attendance.map(log => ({
      'User': userMap.get(log.user_id)?.name || 'Unknown',
      'Date & Time': format(new Date(log.time), 'yyyy-MM-dd HH:mm:ss'),
      'Action': log.action,
      'Status': log.status,
      'Latitude': log.latitude,
      'Longitude': log.longitude,
      'Notes': log.notes || 'N/A',
    }));
    
    const fileName = generateFileName('Attendance', viewingUserName, dateRange);

    exportToExcel(dataToExport, fileName);
  };
  
  const handleEdit = (record: Attendance) => {
    setEditingRecord(record);
    setIsDuplicating(false);
    setIsSheetOpen(true);
  };
  
  const handleAddNew = () => {
    if (!canAddNew) {
        toast({ variant: 'destructive', title: 'Cannot add record', description: 'Please select a specific user to add a new record.'});
        return;
    }
    setEditingRecord(null);
    setIsDuplicating(false);
    setIsSheetOpen(true);
  };

  const handleDuplicate = (record: Attendance) => {
    setEditingRecord(record);
    setIsDuplicating(true);
    setIsSheetOpen(true);
  }
  
  const handleSheetClose = () => {
    setIsSheetOpen(false);
    setEditingRecord(null);
    setIsDuplicating(false);
    mutate();
  }
  
  const handleDelete = async () => {
    if (!recordToDelete) return;

    try {
      await deleteAttendance(recordToDelete.id);
      toast({
        title: 'Record Deleted',
        description: 'The attendance record has been successfully removed.',
      });
      await mutate();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting record',
        description: error.message,
      });
    } finally {
      setRecordToDelete(null);
    }
  };
  
  const handleViewOnMap = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const getStatusBadge = (status: Attendance['status']) => {
    switch (status) {
        case 'day_off':
            return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Day-Off</Badge>;
        case 'absent':
            return <Badge variant="secondary" className="bg-slate-100 text-slate-800">Absent</Badge>;
        default:
            return null;
    }
  }

  const canEdit = selectedUser?.role === 'admin';
  const showUserColumn = userId === null;
  const sheetUser = viewingUser || selectedUser;

  return (
    <>
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search in notes..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={actionFilter} onValueChange={(value: 'all' | 'in' | 'out') => setActionFilter(value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Filter by action" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="in">Clock In</SelectItem>
                        <SelectItem value="out">Clock Out</SelectItem>
                    </SelectContent>
                </Select>
                 <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                        dateRange.to ? (
                            <>
                            {format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
                            </>
                        ) : (
                            format(dateRange.from, 'LLL dd, y')
                        )
                        ) : (
                        <span>Pick a date range</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                    />
                    </PopoverContent>
                </Popover>
                 <div className="flex gap-2">
                    <Button onClick={handleAddNew} disabled={!canAddNew} className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Record
                    </Button>
                    <Button variant="outline" onClick={handleExport} className="w-full">
                        <FileDown className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>
        </div>
        <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {showUserColumn && <TableHead>User</TableHead>}
              <TableHead>Date & Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Notes</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {showUserColumn && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  {canEdit && <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>}
                </TableRow>
              ))}
            {error && <TableRow><TableCell colSpan={canEdit ? (showUserColumn ? 6: 5): (showUserColumn ? 5: 4)} className="text-center text-destructive">Failed to load history.</TableCell></TableRow>}
            {!isLoading && attendance?.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEdit ? (showUserColumn ? 6: 5): (showUserColumn ? 5: 4)} className="text-center">No records found for the selected period.</TableCell>
              </TableRow>
            )}
            {attendance?.map((log) => {
              const logUser = userMap.get(log.user_id);
              return (
                <TableRow key={log.id}>
                    {showUserColumn && (
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                    <AvatarFallback>{logUser?.name?.charAt(0) || '?'}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{logUser?.name || 'Unknown User'}</span>
                            </div>
                        </TableCell>
                    )}
                    <TableCell>{format(new Date(log.time), 'PPP p')}</TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            {log.status === 'present' ? (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${log.action === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {log.action.toUpperCase()}
                                </span>
                            ) : getStatusBadge(log.status)}
                        </div>
                    </TableCell>
                    <TableCell>
                    {log.latitude && log.longitude ? (
                        <Button variant="ghost" size="icon" onClick={() => handleViewOnMap(log.latitude!, log.longitude!)}>
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="sr-only">View on map</span>
                        </Button>
                    ) : 'N/A'}
                    </TableCell>
                    <TableCell>{log.notes || 'N/A'}</TableCell>
                    {canEdit && (
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(log)}>
                            <Copy className="h-4 w-4" />
                            <span className="sr-only">Duplicate Record</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(log)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit Record</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setRecordToDelete(log)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Delete Record</span>
                        </Button>
                    </TableCell>
                    )}
              </TableRow>
            )})}
          </TableBody>
        </Table>
        </div>

        {sheetUser && <EditAttendanceSheet
            isOpen={isSheetOpen}
            onClose={handleSheetClose}
            record={editingRecord}
            user={sheetUser}
            isDuplicating={isDuplicating}
        />}
        
      </CardContent>
    </Card>

    <AlertDialog open={!!recordToDelete} onOpenChange={(isOpen) => !isOpen && setRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this attendance record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
