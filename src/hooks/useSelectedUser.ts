'use client';
import { useContext } from 'react';
import { SelectedUserContext } from '@/context/SelectedUserContext';

export const useSelectedUser = () => {
  const context = useContext(SelectedUserContext);
  if (context === undefined) {
    throw new Error('useSelectedUser must be used within a SelectedUserProvider');
  }
  return context;
};
