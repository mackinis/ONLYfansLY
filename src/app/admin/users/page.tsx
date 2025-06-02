
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { UserProfile, SiteSettings } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Search, Edit3, Trash2, CheckCircle, XCircle, Loader2, MessageSquarePlus, MessageSquareOff, VideoOff, Video as VideoIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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
import { cn } from '@/lib/utils';


export default function UsersAdminPage() {
  const { t, siteSettings, refreshSiteSettings, isLoadingSettings } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isUpdatingPermission, setIsUpdatingPermission] = useState<string | null>(null);
  const [isUpdatingLiveAuth, setIsUpdatingLiveAuth] = useState<string | null>(null);
  const { toast } = useToast();

  const [localAuthorizedUserId, setLocalAuthorizedUserId] = useState<string | null | undefined>(undefined);
  const [localIsStreamForLoggedInOnly, setLocalIsStreamForLoggedInOnly] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (siteSettings) {
      setLocalAuthorizedUserId(siteSettings.liveStreamAuthorizedUserId);
      setLocalIsStreamForLoggedInOnly(siteSettings.liveStreamForLoggedInUsersOnly);
    }
  }, [siteSettings]);

  const fetchUsers = useCallback(async (isInitialFetch = false) => {
    if (isInitialFetch) {
      setIsInitialLoading(true);
    }
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const fetchedUsers = await response.json();
      setUsers(fetchedUsers.filter((user: UserProfile) => user.role !== 'admin'));
    } catch (error) {
      toast({ title: t('adminUsersPage.toasts.fetchErrorTitle'), description: error instanceof Error ? error.message : t('adminUsersPage.toasts.fetchErrorDescription'), variant: 'destructive' });
    } finally {
      if (isInitialFetch) {
        setIsInitialLoading(false);
      }
    }
  }, [t, toast]);

  useEffect(() => {
    fetchUsers(true);
  }, [fetchUsers]);

  const handleToggleActive = async (userId: string, currentIsActive: boolean) => {
    setIsUpdatingStatus(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentIsActive }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
          toast({
              title: t('adminUsersPage.toasts.statusUpdateTitle', { status: !currentIsActive ? t('adminUsersPage.status.active') : t('adminUsersPage.status.inactive') }),
              description: t('adminUsersPage.toasts.statusUpdateSuccess', { status: !currentIsActive ? t('adminUsersPage.status.activated') : t('adminUsersPage.status.deactivated') }),
          });
          fetchUsers();
      } else {
          toast({ title: t('adminUsersPage.toasts.errorTitle'), description: result.message || t('adminUsersPage.toasts.genericErrorDescription'), variant: 'destructive' });
      }
    } catch (error) {
        toast({ title: t('adminUsersPage.toasts.errorTitle'), description: t('adminUsersPage.toasts.genericErrorDescription'), variant: 'destructive' });
    } finally {
      setIsUpdatingStatus(null);
    }
  };
  
  const handleToggleTestimonialPermission = async (userId: string, currentPermission?: boolean) => {
    setIsUpdatingPermission(userId);
    const newPermission = !currentPermission;
    try {
      const response = await fetch(`/api/admin/users/${userId}/testimonial-permission`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canSubmitTestimonial: newPermission }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
          toast({
              title: t('adminUsersPage.toasts.testimonialPermissionUpdateTitle'),
              description: t('adminUsersPage.toasts.testimonialPermissionUpdateSuccess', { status: newPermission ? t('adminUsersPage.status.allowed') : t('adminUsersPage.status.denied') }),
          });
          fetchUsers();
      } else {
          toast({ title: t('adminUsersPage.toasts.errorTitle'), description: result.message || t('adminUsersPage.toasts.genericErrorDescription'), variant: 'destructive' });
      }
    } catch (error) {
         toast({ title: t('adminUsersPage.toasts.errorTitle'), description: t('adminUsersPage.toasts.genericErrorDescription'), variant: 'destructive' });
    } finally {
      setIsUpdatingPermission(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
        const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok && result.success) {
            toast({ title: t('adminUsersPage.toasts.deleteSuccessTitle'), description: t('adminUsersPage.toasts.deleteSuccessDescription') });
            fetchUsers(); 
        } else {
            toast({ title: t('adminUsersPage.toasts.errorTitle'), description: result.message || t('adminUsersPage.toasts.deleteErrorDescription'), variant: 'destructive' });
        }
    } catch (error) {
        toast({ title: t('adminUsersPage.toasts.errorTitle'), description: t('adminUsersPage.toasts.genericErrorDescription'), variant: 'destructive' });
    }
  };

  const handleToggleLiveStreamAuthorization = async (user: UserProfile, newCheckedState: boolean) => {
    setIsUpdatingLiveAuth(user.id);
    
    const payload: Partial<SiteSettings> = {};

    if (newCheckedState) { 
      payload.liveStreamAuthorizedUserId = user.id;
      payload.liveStreamForLoggedInUsersOnly = false; 
    } else { 
      if (localAuthorizedUserId === user.id) { 
        payload.liveStreamAuthorizedUserId = null;
      } else {
        setIsUpdatingLiveAuth(null);
        return; 
      }
    }

    try {
      const response = await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (response.ok && result.success !== false) {
        setLocalAuthorizedUserId(payload.liveStreamAuthorizedUserId ?? null);
        if (payload.liveStreamForLoggedInUsersOnly !== undefined) {
          setLocalIsStreamForLoggedInOnly(payload.liveStreamForLoggedInUsersOnly);
        }
        fetchUsers(); // Call fetchUsers to mimic other switches' refresh behavior

        toast({
          title: t('adminUsersPage.toasts.liveAuthSuccessTitle'),
          description: newCheckedState
            ? t('adminUsersPage.toasts.liveAuthSetSuccess', { userName: `${user.name} ${user.surname}` })
            : t('adminUsersPage.toasts.liveDeauthSuccess'),
        });
      } else {
        toast({ 
            title: t('adminUsersPage.toasts.errorTitle'), 
            description: result.message || t('adminUsersPage.toasts.liveAuthError'), 
            variant: 'destructive' 
        });
      }
    } catch (error) {
      toast({ title: t('adminUsersPage.toasts.errorTitle'), description: t('adminUsersPage.toasts.liveAuthError'), variant: 'destructive' });
    } finally {
      setIsUpdatingLiveAuth(null);
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

  if (isInitialLoading || isLoadingSettings || localAuthorizedUserId === undefined || localIsStreamForLoggedInOnly === undefined) {
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
                <TableHead>{t('adminUsersPage.table.authorizeLive')}</TableHead>
                <TableHead className="text-right">{t('adminUsersPage.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                 <TableRow><TableCell colSpan={9} className="h-24 text-center">
                    {searchTerm ? t('adminUsersPage.noUsersFoundSearch') : t('adminUsersPage.noUsersToShow')}
                 </TableCell></TableRow>
              ) : (
                filteredUsers.map(user => {
                  const isThisUserCurrentlyAuthorizedForLive = localAuthorizedUserId === user.id && !localIsStreamForLoggedInOnly;
                  const disableIndividualAuthSwitch = localIsStreamForLoggedInOnly === true;

                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name} {user.surname}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                             <VideoIcon className="h-4 w-4 mr-1 text-muted-foreground"/> 
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
                            disabled={isUpdatingStatus === user.id}
                          />
                          {isUpdatingStatus === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <Label htmlFor={`user-status-${user.id}`} className={user.isActive ? 'text-green-500' : 'text-red-500'}>
                              {user.isActive ? t('adminUsersPage.status.active') : t('adminUsersPage.status.inactive')}
                            </Label>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center">
                            <Switch
                                id={`testimonial-permission-${user.id}`}
                                checked={user.canSubmitTestimonial || false}
                                onCheckedChange={() => handleToggleTestimonialPermission(user.id, user.canSubmitTestimonial)}
                                aria-label={t('adminUsersPage.toggleTestimonialPermissionAria', { email: user.email })}
                                disabled={isUpdatingPermission === user.id}
                            />
                            {isUpdatingPermission === user.id ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : (
                                user.canSubmitTestimonial ? <MessageSquarePlus className="ml-2 h-5 w-5 text-green-500" /> : <MessageSquareOff className="ml-2 h-5 w-5 text-red-500" />
                            )}
                         </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`live-auth-${user.id}`}
                            checked={isThisUserCurrentlyAuthorizedForLive}
                            onCheckedChange={(newCheckedState) => handleToggleLiveStreamAuthorization(user, newCheckedState)}
                            disabled={isUpdatingLiveAuth === user.id || disableIndividualAuthSwitch}
                            aria-label={t('adminUsersPage.toggleLiveAuthAria', { userName: `${user.name} ${user.surname}` })}
                            title={disableIndividualAuthSwitch ? t('adminUsersPage.toasts.specificAuthDisabledTooltip') : ''}
                          />
                          {isUpdatingLiveAuth === user.id && <Loader2 className="h-4 w-4 animate-spin" />}
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
                  )
                }
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

    
