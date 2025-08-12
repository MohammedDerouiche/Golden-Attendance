'use client';

import { createContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import useSWR from 'swr';
import { getUsers } from '@/lib/supabase/api';
import type { User } from '@/lib/supabase/types';
import { LOCAL_STORAGE_KEY } from '@/lib/constants';

interface SelectedUserContextType {
  users: User[];
  selectedUser: User | null;
  setSelectedUser: (user: User | null) => void;
  isLoading: boolean;
  error: any;
  mutateUsers: () => void;
}

export const SelectedUserContext = createContext<SelectedUserContextType | undefined>(undefined);

export function SelectedUserProvider({ children }: { children: ReactNode }) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const { data: users, error, isLoading, mutate } = useSWR('users', getUsers, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!isLoading) {
      const storedUserId = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedUserId && users) {
        const user = users.find(u => u.id === storedUserId);
        if (user) {
          setSelectedUser(user);
        } else {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
      setIsInitializing(false);
    }
  }, [users, isLoading]);

  const handleSetSelectedUser = useCallback((user: User | null) => {
    setSelectedUser(user);
    if (user) {
      localStorage.setItem(LOCAL_STORAGE_KEY, user.id);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  const value = useMemo(() => ({
    users: users || [],
    selectedUser,
    setSelectedUser: handleSetSelectedUser,
    isLoading: isLoading || isInitializing,
    error,
    mutateUsers: mutate,
  }), [users, selectedUser, handleSetSelectedUser, isLoading, isInitializing, error, mutate]);

  return (
    <SelectedUserContext.Provider value={value}>
      {children}
    </SelectedUserContext.Provider>
  );
}
