'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Skeleton } from './ui/skeleton';

export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  if (!now) {
    return (
        <div className="text-center mb-8">
            <Skeleton className="h-20 w-80 mx-auto" />
            <Skeleton className="h-7 w-64 mx-auto mt-2" />
        </div>
    );
  }

  return (
    <div className="text-center mb-8 animate-fade-in">
      <p className="text-6xl md:text-8xl font-bold font-code text-primary/90 tracking-wider tabular-nums">
        {format(now, 'HH:mm:ss')}
      </p>
      <p className="text-lg md:text-xl text-muted-foreground mt-2">
        {format(now, 'eeee, MMMM do, yyyy')}
      </p>
    </div>
  );
}
