
'use client';

import { useMemo } from 'react';
import { eachDayOfInterval, startOfMonth, endOfMonth, getDay, format, isSameMonth, isToday } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type HeatmapData = {
  [key: string]: {
    status: 'worked' | 'day_off' | 'absent';
  };
};

interface AttendanceHeatmapProps {
  data: HeatmapData;
  month: Date;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AttendanceHeatmap({ data, month }: AttendanceHeatmapProps) {
  const { days, firstDayOffset } = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });
    const firstDayOffset = getDay(start); // 0 = Sunday, 1 = Monday, etc.
    return { days, firstDayOffset };
  }, [month]);

  const getStatusInfo = (status: string | undefined) => {
    switch (status) {
      case 'worked':
        return { color: 'bg-green-500', label: 'Worked' };
      case 'day_off':
        return { color: 'bg-yellow-500', label: 'Day-Off' };
      case 'absent':
        return { color: 'bg-red-500', label: 'Absent' };
      default:
        return { color: 'bg-muted/50', label: 'No Data' };
    }
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-7 gap-2 text-center text-xs">
        {WEEKDAYS.map(day => (
          <div key={day} className="font-semibold text-muted-foreground">{day}</div>
        ))}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(day => {
          const dayString = format(day, 'yyyy-MM-dd');
          const status = data[dayString]?.status;
          const { color, label } = getStatusInfo(status);

          return (
            <Tooltip key={dayString} delayDuration={100}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'h-10 w-10 rounded-md flex items-center justify-center text-white font-bold',
                    color,
                    isToday(day) && 'ring-2 ring-primary ring-offset-2'
                  )}
                >
                  {format(day, 'd')}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{format(day, 'PPP')}</p>
                <p>Status: {label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
