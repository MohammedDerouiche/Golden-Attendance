'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import UserSelector from '@/components/UserSelector';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Clock as ClockIcon } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AddUserForm from '../AddUserForm';
import type { User as UserType } from '@/lib/supabase/types';

export default function Header() {
  const { selectedUser } = useSelectedUser();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);

  const handleCloseDialogs = () => {
    setIsAddUserOpen(false);
    setEditingUser(null);
  };

  const pathname = usePathname();

  return (
    <div>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur-sm">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex items-center">
            <Link href="/" className="flex items-center gap-2 font-bold text-primary" prefetch={false}>
              <ClockIcon className="h-6 w-6" />
              <span className="font-headline text-xl">GoldenClock</span>
            </Link>
          </div>
          <nav className="flex flex-1 items-center space-x-2 justify-end">
              {selectedUser?.role === 'admin' && (
                  <>
                  <Button variant="link" asChild>
                      <Link href="/users">Users</Link>
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <Button variant="link" asChild>
                      <Link href="/active">Active</Link>
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  </>
              )}
              {selectedUser && (
                  <>
                  <Button variant="link" asChild>
                      <Link href="/history">History</Link>
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                   <Button variant="link" asChild>
                      <Link href="/salary">Salary</Link>
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                   <Button variant="link" asChild>
                      <Link href="/statistics">Statistics</Link>
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                   <Button variant="link" asChild>
                      <Link href="/settings">Settings</Link>
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  </>
              )}
              <UserSelector 
                onAddNewUser={() => setIsAddUserOpen(true)}
                onEditUser={(user) => setEditingUser(user)}
              />
          </nav>
        </div>
      </header>
      
      {/* DIALOGS */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a New User</DialogTitle>
          </DialogHeader>
          <AddUserForm onFinished={handleCloseDialogs} />
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!editingUser} onOpenChange={(isOpen) => !isOpen && setEditingUser(null)}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
              </DialogHeader>
              <AddUserForm onFinished={handleCloseDialogs} defaultValues={editingUser!} />
          </DialogContent>
      </Dialog>
    </div>
  );
}
