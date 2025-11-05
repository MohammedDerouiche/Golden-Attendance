
'use client';

import Link from 'next/link';
import { useSelectedUser } from '@/hooks/useSelectedUser';
import UserSelector from '@/components/UserSelector';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Clock as ClockIcon, Menu, Home, History, DollarSign, BarChart, Settings, Users, Activity, ListChecks, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AddUserForm from '../AddUserForm';
import type { User as UserType } from '@/lib/supabase/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NavLink = ({ href, children, onNavigate }: { href: string; children: React.ReactNode, onNavigate: () => void }) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Button
      asChild
      variant={isActive ? 'secondary' : 'ghost'}
      className="justify-start gap-2 w-full"
      onClick={onNavigate}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
};


export default function Header() {
  const { selectedUser } = useSelectedUser();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);

  const handleCloseDialogs = () => {
    setIsAddUserOpen(false);
    setEditingUser(null);
  };
  
  const handleOpenAddUser = () => {
    setIsSheetOpen(false);
    setIsAddUserOpen(true);
  }

  const handleOpenEditUser = (user: UserType) => {
    setIsSheetOpen(false);
    setEditingUser(user);
  };
  
  const handleNavLinkClick = () => {
    setIsSheetOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur-sm">
        <div className="container flex h-16 items-center">
          <div className="mr-auto flex items-center">
            <Link href="/" className="flex items-center gap-2 font-bold text-primary" prefetch={false}>
              <ClockIcon className="h-6 w-6" />
              <span className="font-headline text-xl">GoldenClock</span>
            </Link>
          </div>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader className="mb-4">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col justify-between h-[calc(100%-4rem)]">
                <div className="flex-grow space-y-4">
                  <UserSelector 
                    onAddNewUser={handleOpenAddUser}
                    onEditUser={handleOpenEditUser}
                  />

                  {selectedUser && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <NavLink href="/" onNavigate={handleNavLinkClick}><Home /> Home</NavLink>
                         {selectedUser.role === 'admin' && (
                            <>
                                <NavLink href="/users" onNavigate={handleNavLinkClick}><Users /> User Management</NavLink>
                                <NavLink href="/active" onNavigate={handleNavLinkClick}><Activity /> Active Employees</NavLink>
                            </>
                         )}
                        <NavLink href="/demands" onNavigate={handleNavLinkClick}><ShoppingCart /> Demands</NavLink>
                        <NavLink href="/history" onNavigate={handleNavLinkClick}><History /> History</NavLink>
                        <NavLink href="/tasks" onNavigate={handleNavLinkClick}><ListChecks /> Tasks</NavLink>
                        <NavLink href="/salary" onNavigate={handleNavLinkClick}><DollarSign /> Salary</NavLink>
                        <NavLink href="/statistics" onNavigate={handleNavLinkClick}><BarChart /> Statistics</NavLink>
                        <NavLink href="/settings" onNavigate={handleNavLinkClick}><Settings /> Settings</NavLink>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>

        </div>
      </header>
      
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
    </>
  );
}
