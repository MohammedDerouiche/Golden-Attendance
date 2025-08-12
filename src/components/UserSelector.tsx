'use client';

import { useState } from 'react';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import { User, ChevronsUpDown, PlusCircle, LogOut, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Avatar, AvatarFallback } from './ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { deleteUser } from '@/lib/supabase/api';
import type { User as UserType } from '@/lib/supabase/types';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface UserSelectorProps {
  onAddNewUser: () => void;
  onEditUser: (user: UserType) => void;
}

export default function UserSelector({ onAddNewUser, onEditUser }: UserSelectorProps) {
  const { users, selectedUser, setSelectedUser, isLoading, error, mutateUsers } = useSelectedUser();
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [passwordPromptUser, setPasswordPromptUser] = useState<UserType | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const { toast } = useToast();

  const handleSelectUser = (user: UserType) => {
    if (user.role === 'admin') {
      setPasswordPromptUser(user);
    } else {
      setSelectedUser(user);
    }
  };
  
  const handleClearUser = () => {
    setSelectedUser(null);
  };
  
  const handlePasswordSubmit = () => {
    if (!passwordPromptUser) return;

    if (passwordInput === passwordPromptUser.password) {
      setSelectedUser(passwordPromptUser);
      toast({
          title: `Welcome, ${passwordPromptUser.name}`,
          description: 'Admin access granted.',
      })
    } else {
      toast({
        variant: 'destructive',
        title: 'Incorrect Password',
        description: 'The password you entered is incorrect. Please try again.',
      });
    }
    setPasswordPromptUser(null);
    setPasswordInput('');
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await deleteUser(userToDelete.id);
      toast({
        title: 'User Deleted',
        description: `${userToDelete.name} has been successfully removed.`,
      });
      await mutateUsers(); // Re-fetch the user list

      if (selectedUser?.id === userToDelete.id) {
        setSelectedUser(null);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting user',
        description: error.message,
      });
    } finally {
      setUserToDelete(null);
    }
  };

  if (isLoading) {
    return <Button variant="outline" disabled>Loading users...</Button>;
  }

  if (error) {
    return <Button variant="destructive" disabled>Error</Button>;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[200px] justify-between">
            {selectedUser ? (
              <>
                <span>{selectedUser.name}</span>
                <span className="text-xs capitalize text-muted-foreground">{selectedUser.role}</span>
              </>
            ) : (
              'Select User'
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[240px]" align="end">
          <DropdownMenuLabel>Switch User</DropdownMenuLabel>
          <DropdownMenuGroup>
            {users.map((user) => (
              <DropdownMenuItem key={user.id} onSelect={() => handleSelectUser(user)} className="flex justify-between items-center">
                 <div className="flex items-center">
                  <Avatar className="h-6 w-6 mr-2">
                      <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>{user.name}</span>
                 </div>
                {selectedUser?.role === 'admin' && (
                   <div className='flex items-center'>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
                          e.stopPropagation();
                          onEditUser(user);
                      }}>
                          <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
                          e.stopPropagation();
                          setUserToDelete(user);
                      }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                   </div>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onAddNewUser}>
            <PlusCircle className="mr-2 h-4 w-4" />
            <span>Add New User</span>
          </DropdownMenuItem>
          {selectedUser && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleClearUser} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Clear Selection</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!passwordPromptUser} onOpenChange={(isOpen) => !isOpen && setPasswordPromptUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Admin Verification</AlertDialogTitle>
            <AlertDialogDescription>
              Please enter the password for '{passwordPromptUser?.name}' to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="password-input">Password</Label>
            <Input 
                id="password-input"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPasswordInput('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePasswordSubmit}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user '{userToDelete?.name}' and all of their associated attendance records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
