'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { getActiveEmployees } from '@/lib/supabase/api';
import type { ActiveEmployee } from '@/lib/supabase/types';
import AdminGuard from '@/components/AdminGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowUpDown } from 'lucide-react';

type SortKey = 'name' | 'clock_in_time' | 'duration';

export default function ActiveEmployeesPage() {
  const { data: activeEmployees, error, isLoading } = useSWR(
    'activeEmployees',
    getActiveEmployees,
    { refreshInterval: 60000 } // Refresh every 60 seconds
  );

  const [sortedData, setSortedData] = useState<ActiveEmployee[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('clock_in_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (activeEmployees) {
      const sorted = [...activeEmployees].sort((a, b) => {
        let valA: any, valB: any;
        
        if (sortKey === 'duration') {
            valA = new Date(a.clock_in_time).getTime();
            valB = new Date(b.clock_in_time).getTime();
        } else if (sortKey === 'clock_in_time') {
            valA = new Date(a.clock_in_time).getTime();
            valB = new Date(b.clock_in_time).getTime();
        } else {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
      setSortedData(sorted);
    }
  }, [activeEmployees, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const handleViewOnMap = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-4 w-4 ml-2 opacity-30" />;
    return sortDirection === 'desc' 
      ? <ArrowUpDown className="h-4 w-4 ml-2" />
      : <ArrowUpDown className="h-4 w-4 ml-2 transform rotate-180" />;
  };

  return (
    <AdminGuard>
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-headline font-bold mb-2 text-primary">Active Employees</h1>
        <p className="text-muted-foreground mb-6">A live list of employees who are currently clocked in.</p>
        
        <Card>
          <CardHeader>
            <CardTitle>Currently Clocked In ({activeEmployees?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('name')}>
                            Employee Name
                            {getSortIndicator('name')}
                        </Button>
                    </TableHead>
                    <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('clock_in_time')}>
                            Clock In Time
                            {getSortIndicator('clock_in_time')}
                        </Button>
                    </TableHead>
                    <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('duration')}>
                            Duration
                            {getSortIndicator('duration')}
                        </Button>
                    </TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))}
                  {error && <TableRow><TableCell colSpan={4} className="text-center text-destructive">Failed to load data.</TableCell></TableRow>}
                  {!isLoading && sortedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">No employees are currently clocked in.</TableCell>
                    </TableRow>
                  )}
                  {sortedData.map((employee) => (
                    <TableRow key={employee.user_id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{parseISO(employee.clock_in_time).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-accent/90">
                        {formatDistanceToNow(parseISO(employee.clock_in_time), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {employee.latitude && employee.longitude ? (
                          <Button variant="ghost" size="icon" onClick={() => handleViewOnMap(employee.latitude!, employee.longitude!)}>
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="sr-only">View on map</span>
                          </Button>
                        ) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}
