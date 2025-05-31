
'use client';

import { useEffect, useState } from 'react';
import type { UserProfile } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Search, Edit3, Trash2, CheckCircle, XCircle, Loader2, MessageSquarePlus, MessageSquareOff, BookText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getAllUsers, updateUserActiveStatus, deleteUserById, updateUserTestimonialPermission } from '@/lib/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTranslation } from '@/context/I18nContext';


export default function UsersAdminPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await getAllUsers();
      setUsers(fetchedUsers.filter(user => user.role !== 'admin'));
    } catch (error) {
      toast({ title: t('adminUsersPage.toasts.fetchErrorTitle'), description: t('adminUsersPage.toasts.fetchErrorDescription'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleActive = async (userId: string, currentIsActive: boolean) => {
    const result = await updateUserActiveStatus(userId, !currentIsActive);
    if (result.success) {
        toast({
            title: t('adminUsersPage.toasts.statusUpdateTitle', { status: !currentIsActive ? t('adminUsersPage.status.active') : t('adminUsersPage.status.inactive') }),
            description: t('adminUsersPage.toasts.statusUpdateSuccess', { status: !currentIsActive ? t('adminUsersPage.status.activated') : t('adminUsersPage.status.deactivated') }),
        });
        fetchUsers();
    } else {
        toast({ title: t('adminUsersPage.toasts.errorTitle'), description: result.message, variant: 'destructive' });
    }
  };
  
  const handleToggleTestimonialPermission = async (userId: string, currentPermission?: boolean) => {
    const newPermission = !currentPermission;
    const result = await updateUserTestimonialPermission(userId, newPermission);
    if (result.success) {
        toast({
            title: t('adminUsersPage.toasts.testimonialPermissionUpdateTitle'),
            description: t('adminUsersPage.toasts.testimonialPermissionUpdateSuccess', { status: newPermission ? t('adminUsersPage.status.allowed') : t('adminUsersPage.status.denied') }),
        });
        fetchUsers();
    } else {
        toast({ title: t('adminUsersPage.toasts.errorTitle'), description: result.message, variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
        const result = await deleteUserById(userId);
        if (result.success) {
            toast({ title: t('adminUsersPage.toasts.deleteSuccessTitle'), description: t('adminUsersPage.toasts.deleteSuccessDescription') });
            fetchUsers(); 
        } else {
            toast({ title: t('adminUsersPage.toasts.errorTitle'), description: result.message || t('adminUsersPage.toasts.deleteErrorDescription'), variant: 'destructive' });
        }
    } catch (error) {
        toast({ title: t('adminUsersPage.toasts.errorTitle'), description: t('adminUsersPage.toasts.genericErrorDescription'), variant: 'destructive' });
    }
  };
  
  const openEditModal = (user: UserProfile) => {
    toast({ title: t('adminUsersPage.toasts.comingSoonTitle'), description: t('adminUsersPage.toasts.editUserComingSoon')});
  };

  const filteredUsers = users.filter(user =>
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.surname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <Users className="mr-3 h-8 w-8" /> {t('adminUsersPage.title')}
        </h1>
        <Button onClick={() => toast({title: t('adminUsersPage.toasts.comingSoonTitle'), description: t('adminUsersPage.toasts.addUserComingSoon')})}>
          <UserPlus className="mr-2 h-4 w-4" /> {t('adminUsersPage.addUserButton')}
        </Button>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminUsersPage.listTitle')}</CardTitle>
          <CardDescription>{t('adminUsersPage.listDescription')}</CardDescription>
           <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder={t('adminUsersPage.searchPlaceholder')} 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('adminUsersPage.table.name')}</TableHead>
                <TableHead>{t('adminUsersPage.table.email')}</TableHead>
                <TableHead>{t('adminUsersPage.table.stories')}</TableHead>
                <TableHead>{t('adminUsersPage.table.role')}</TableHead>
                <TableHead>{t('adminUsersPage.table.verified')}</TableHead>
                <TableHead>{t('adminUsersPage.table.status')}</TableHead>
                <TableHead>{t('adminUsersPage.table.canSubmitTestimonial')}</TableHead>
                <TableHead className="text-right">{t('adminUsersPage.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                 <TableRow><TableCell colSpan={8} className="h-24 text-center">
                    {searchTerm ? t('adminUsersPage.noUsersFoundSearch') : t('adminUsersPage.noUsersToShow')}
                 </TableCell></TableRow>
              ) : (
                filteredUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name} {user.surname}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                        <BookText className="h-4 w-4 mr-1 text-muted-foreground"/> 
                        {user.testimonialCount ?? 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.isVerified ? 
                        <CheckCircle className="h-5 w-5 text-green-500" /> : 
                        <XCircle className="h-5 w-5 text-red-500" />}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                       <Switch
                        id={`user-status-${user.id}`}
                        checked={user.isActive}
                        onCheckedChange={() => handleToggleActive(user.id, user.isActive)}
                        aria-label={t('adminUsersPage.toggleActivationAria', { email: user.email })}
                      />
                      <Label htmlFor={`user-status-${user.id}`} className={user.isActive ? 'text-green-500' : 'text-red-500'}>
                        {user.isActive ? t('adminUsersPage.status.active') : t('adminUsersPage.status.inactive')}
                      </Label>
                    </div>
                  </TableCell>
                  <TableCell>
                     <div className="flex items-center">
                        <Switch
                            id={`testimonial-permission-${user.id}`}
                            checked={user.canSubmitTestimonial || false}
                            onCheckedChange={() => handleToggleTestimonialPermission(user.id, user.canSubmitTestimonial)}
                            aria-label={t('adminUsersPage.toggleTestimonialPermissionAria', { email: user.email })}
                        />
                        {user.canSubmitTestimonial ? <MessageSquarePlus className="ml-2 h-5 w-5 text-green-500" /> : <MessageSquareOff className="ml-2 h-5 w-5 text-red-500" />}
                     </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="hover:text-primary" onClick={() => openEditModal(user)}>
                        <Edit3 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('adminUsersPage.deleteDialog.title')}</AlertDialogTitle>
                          <AlertDialogDescription>
                             {t('adminUsersPage.deleteDialog.description', { email: user.email })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('adminUsersPage.deleteDialog.cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className={buttonVariants({variant: "destructive"})}>
                            {t('adminUsersPage.deleteDialog.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

