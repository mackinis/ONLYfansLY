
'use client';

import { useEffect, useState } from 'react';
import type { Announcement, AnnouncementContentType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as ShadFormDescription } from '@/components/ui/form';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Edit, Trash2, Loader2, Megaphone, CalendarIcon, Image as ImageIcon, Video as VideoIconLucide, CheckSquare, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// Removed: import { createAnnouncement, getAnnouncements, updateAnnouncement, deleteAnnouncement } from '@/lib/actions';
import { useTranslation } from '@/context/I18nContext';
import { DatePicker } from '@/components/ui/date-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
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
import { format } from 'date-fns';
import { announcementSchema as announcementFormSchema } from '@/lib/actions'; // Using the schema from actions

type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;

export default function AdminAnnouncementsPage() {
  const { t, language } = useTranslation();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const { toast } = useToast();

  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: {
      title: '',
      contentType: undefined, // Let user select
      text: '',
      imageUrl: '',
      videoUrl: '',
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week from now
      isActive: true,
      showOnce: false,
    },
  });

  const contentType = form.watch('contentType');

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/announcements');
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const fetchedAnnouncements = await response.json();
      setAnnouncements(fetchedAnnouncements);
    } catch (error) {
      toast({ title: t('adminAnnouncementsPage.toasts.fetchErrorTitle'), description: error instanceof Error ? error.message : t('adminAnnouncementsPage.toasts.fetchErrorDescription'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenModal = (announcement?: Announcement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      form.reset({
        title: announcement.title,
        contentType: announcement.contentType,
        text: announcement.text || '',
        imageUrl: announcement.imageUrl || '',
        videoUrl: announcement.videoUrl || '',
        expiryDate: new Date(announcement.expiryDate),
        isActive: announcement.isActive,
        showOnce: announcement.showOnce ?? false,
      });
    } else {
      setEditingAnnouncement(null);
      form.reset({
        title: '',
        contentType: undefined,
        text: '',
        imageUrl: '',
        videoUrl: '',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week from now
        isActive: true,
        showOnce: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAnnouncement(null);
    form.reset();
  };

  const onSubmit = async (data: AnnouncementFormValues) => {
    setIsSubmitting(true);
    try {
      let response;
      let url = '/api/admin/announcements';
      let method = 'POST';

      if (editingAnnouncement) {
        url = `/api/admin/announcements/${editingAnnouncement.id}`;
        method = 'PUT';
      }

      response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();

      if (response.ok && result.success) {
        toast({ title: editingAnnouncement ? t('adminAnnouncementsPage.toasts.updateSuccessTitle') : t('adminAnnouncementsPage.toasts.createSuccessTitle'), description: result.message });
        handleCloseModal();
        fetchAnnouncements();
      } else {
        toast({ title: t('adminAnnouncementsPage.toasts.submitErrorTitle'), description: result.message || t('adminAnnouncementsPage.toasts.submitErrorDescription'), variant: 'destructive' });
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, errors]) => {
            if (Array.isArray(errors) && errors.length > 0) {
               form.setError(field as keyof AnnouncementFormValues, { message: errors[0] as string });
            }
          });
        }
      }
    } catch (error) {
      toast({ title: t('adminAnnouncementsPage.toasts.submitErrorTitle'), description: error instanceof Error ? error.message : t('adminAnnouncementsPage.toasts.unknownError'), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    try {
      const response = await fetch(`/api/admin/announcements/${announcementId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (response.ok && result.success) {
        toast({ title: t('adminAnnouncementsPage.toasts.deleteSuccessTitle'), description: result.message });
        fetchAnnouncements();
      } else {
        toast({ title: t('adminAnnouncementsPage.toasts.deleteErrorTitle'), description: result.message || t('adminAnnouncementsPage.toasts.deleteErrorDescription'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('adminAnnouncementsPage.toasts.deleteErrorTitle'), description: error instanceof Error ? error.message : t('adminAnnouncementsPage.toasts.unknownError'), variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <Megaphone className="mr-3 h-8 w-8" /> {t('adminAnnouncementsPage.title')}
        </h1>
        <Button onClick={() => handleOpenModal()}>
          <PlusCircle className="mr-2 h-4 w-4" /> {t('adminAnnouncementsPage.addAnnouncementButton')}
        </Button>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminAnnouncementsPage.listTitle')}</CardTitle>
          <CardDescription>{t('adminAnnouncementsPage.listDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('adminAnnouncementsPage.table.title')}</TableHead>
                <TableHead>{t('adminAnnouncementsPage.table.contentType')}</TableHead>
                <TableHead>{t('adminAnnouncementsPage.table.status')}</TableHead>
                <TableHead>{t('adminAnnouncementsPage.table.expiryDate')}</TableHead>
                <TableHead>{t('adminAnnouncementsPage.table.showOnce')}</TableHead>
                <TableHead className="text-right">{t('adminAnnouncementsPage.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">{t('adminAnnouncementsPage.noAnnouncements')}</TableCell></TableRow>
              ) : (
                announcements.map(announcement => (
                  <TableRow key={announcement.id}>
                    <TableCell className="font-medium">{announcement.title}</TableCell>
                    <TableCell>{t(`adminAnnouncementsPage.contentTypeLabels.${announcement.contentType.replace(/-/g, '_')}`)}</TableCell>
                    <TableCell>
                       <span className={`px-2 py-1 text-xs font-semibold rounded-full ${announcement.isActive ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100'}`}>
                        {announcement.isActive ? t('adminAnnouncementsPage.status.active') : t('adminAnnouncementsPage.status.inactive')}
                       </span>
                    </TableCell>
                    <TableCell>{format(new Date(announcement.expiryDate), language === 'es' ? 'dd/MM/yyyy' : 'MM/dd/yyyy')}</TableCell>
                     <TableCell className="text-center">
                      {announcement.showOnce ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="hover:text-primary" onClick={() => handleOpenModal(announcement)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('adminAnnouncementsPage.deleteDialog.title')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('adminAnnouncementsPage.deleteDialog.description', { announcementTitle: announcement.title })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('adminAnnouncementsPage.deleteDialog.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteAnnouncement(announcement.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                              {t('adminAnnouncementsPage.deleteDialog.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); else setIsModalOpen(true);}}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl text-primary">
              {editingAnnouncement ? t('adminAnnouncementsPage.editModal.title') : t('adminAnnouncementsPage.addModal.title')}
            </DialogTitle>
            <DialogDescription>
              {editingAnnouncement ? t('adminAnnouncementsPage.editModal.description') : t('adminAnnouncementsPage.addModal.description')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <div className="max-h-[65vh] overflow-y-auto px-2 py-1">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>{t('adminAnnouncementsPage.form.title')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="contentType" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{t('adminAnnouncementsPage.form.contentType')}</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="image-only" /></FormControl>
                        <FormLabel className="font-normal">{t('adminAnnouncementsPage.contentTypeLabels.image_only')}</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="video-only" /></FormControl>
                        <FormLabel className="font-normal">{t('adminAnnouncementsPage.contentTypeLabels.video_only')}</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="text-image" /></FormControl>
                        <FormLabel className="font-normal">{t('adminAnnouncementsPage.contentTypeLabels.text_image')}</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="text-video" /></FormControl>
                        <FormLabel className="font-normal">{t('adminAnnouncementsPage.contentTypeLabels.text_video')}</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {(contentType === 'text-image' || contentType === 'text-video') && (
                <FormField control={form.control} name="text" render={({ field }) => (
                  <FormItem><FormLabel>{t('adminAnnouncementsPage.form.text')}</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
              {(contentType === 'image-only' || contentType === 'text-image') && (
                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                  <FormItem><FormLabel>{t('adminAnnouncementsPage.form.imageUrl')}</FormLabel><FormControl><Input placeholder="https://placehold.co/800x400" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
              {(contentType === 'text-video' || contentType === 'video-only') && (
                <FormField control={form.control} name="videoUrl" render={({ field }) => (
                  <FormItem><FormLabel>{t('adminAnnouncementsPage.form.videoUrl')}</FormLabel><FormControl><Input placeholder="https://youtube.com/watch?v=..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}

              <FormField control={form.control} name="expiryDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t('adminAnnouncementsPage.form.expiryDate')}</FormLabel>
                  <DatePicker
                    date={field.value}
                    setDate={field.onChange}
                    disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))} // Disable past dates
                    placeholder={t('adminAnnouncementsPage.form.expiryDatePlaceholder')}
                  />
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
                    <div className="space-y-0.5">
                      <FormLabel>{t('adminAnnouncementsPage.form.isActive')}</FormLabel>
                      <ShadFormDescription>{t('adminAnnouncementsPage.form.isActiveDescription')}</ShadFormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
              )} />
              <FormField control={form.control} name="showOnce" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
                    <div className="space-y-0.5">
                      <FormLabel>{t('adminAnnouncementsPage.form.showOnce')}</FormLabel>
                      <ShadFormDescription>{t('adminAnnouncementsPage.form.showOnceDescription')}</ShadFormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
              )} />
             </div>
              <DialogFooter className="pt-4 border-t mt-4">
                <DialogClose asChild><Button type="button" variant="outline">{t('adminAnnouncementsPage.form.cancel')}</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAnnouncement ? t('adminAnnouncementsPage.form.saveChanges') : t('adminAnnouncementsPage.form.createAnnouncement')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    