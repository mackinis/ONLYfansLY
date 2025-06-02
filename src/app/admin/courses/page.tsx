
'use client';

import { useEffect, useState } from 'react';
import type { Video } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as ShadFormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Edit, Trash2, Loader2, Video as VideoIcon, ArrowUp, ArrowDown, Save, Eye, Percent, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// Removed: import { getVideoCourses, createVideoCourse, updateVideoCourse, deleteVideoCourse, updateVideoCoursesOrder } from '@/lib/actions';
import { useTranslation } from '@/context/I18nContext';
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
import { videoCourseSchema } from '@/lib/actions'; // Import schema

type CourseFormValues = z.infer<typeof videoCourseSchema>;

export default function AdminCoursesPage() {
  const { t, language } = useTranslation();
  const [courses, setCourses] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Video | null>(null);
  const [isOrderChanged, setIsOrderChanged] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const { toast } = useToast();

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(videoCourseSchema),
    defaultValues: {
      title: '',
      description: '',
      previewImageUrl: '',
      videoUrl: '',
      priceArs: 0,
      discountInput: '',
      duration: '',
    },
  });

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/video-courses');
      if (!response.ok) {
        throw new Error(t('adminCoursesPage.toasts.fetchErrorDescription'));
      }
      const fetchedCourses = await response.json();
      setCourses(fetchedCourses);
      setIsOrderChanged(false); 
    } catch (error) {
      toast({ title: t('adminCoursesPage.toasts.fetchErrorTitle'), description: error instanceof Error ? error.message : t('adminCoursesPage.toasts.fetchErrorDescription'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenModal = (course?: Video) => {
    if (course) {
      setEditingCourse(course);
      form.reset({
        title: course.title,
        description: course.description,
        previewImageUrl: course.previewImageUrl || '',
        videoUrl: course.videoUrl,
        priceArs: course.priceArs,
        discountInput: course.discountInput || '',
        duration: course.duration || '',
      });
    } else {
      setEditingCourse(null);
      form.reset({ 
        title: '',
        description: '',
        previewImageUrl: '',
        videoUrl: '',
        priceArs: 0,
        discountInput: '',
        duration: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCourse(null);
    form.reset();
  };

  const onSubmit = async (data: CourseFormValues) => {
    setIsSubmitting(true);
    try {
      let response;
      if (editingCourse) {
        response = await fetch(`/api/video-courses/${editingCourse.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        response = await fetch('/api/video-courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      const result = await response.json();

      if (response.ok && result.success) {
        toast({ title: editingCourse ? t('adminCoursesPage.toasts.updateSuccessTitle') : t('adminCoursesPage.toasts.createSuccessTitle'), description: result.message });
        handleCloseModal();
        fetchCourses();
      } else {
        toast({ title: t('adminCoursesPage.toasts.submitErrorTitle'), description: result.message || t('adminCoursesPage.toasts.submitErrorDescription'), variant: 'destructive' });
         if (result.errors) {
          Object.entries(result.errors).forEach(([field, errors]) => {
             if (Array.isArray(errors) && errors.length > 0) {
                form.setError(field as keyof CourseFormValues, { message: errors[0] as string });
             }
          });
        }
      }
    } catch (error) {
      toast({ title: t('adminCoursesPage.toasts.submitErrorTitle'), description: error instanceof Error ? error.message : t('adminCoursesPage.toasts.unknownError'), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      const response = await fetch(`/api/video-courses/${courseId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast({ title: t('adminCoursesPage.toasts.deleteSuccessTitle'), description: result.message });
        fetchCourses();
      } else {
        toast({ title: t('adminCoursesPage.toasts.deleteErrorTitle'), description: result.message || t('adminCoursesPage.toasts.deleteErrorDescription'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('adminCoursesPage.toasts.deleteErrorTitle'), description: error instanceof Error ? error.message : t('adminCoursesPage.toasts.unknownError'), variant: 'destructive' });
    }
  };

  const handleMove = (courseId: string, direction: 'up' | 'down') => {
    const currentIndex = courses.findIndex(c => c.id === courseId);
    if (currentIndex === -1) return;

    const newCourses = [...courses];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= newCourses.length) return;

    [newCourses[currentIndex], newCourses[targetIndex]] = [newCourses[targetIndex], newCourses[currentIndex]];
    
    setCourses(newCourses);
    setIsOrderChanged(true);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    const coursesToUpdate = courses.map((course, index) => ({
      id: course.id,
      order: index + 1, 
    }));
    try {
      const response = await fetch('/api/video-courses/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coursesToUpdate),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast({ title: t('adminCoursesPage.toasts.orderUpdateSuccessTitle'), description: result.message });
        setIsOrderChanged(false);
      } else {
        toast({ title: t('adminCoursesPage.toasts.orderUpdateErrorTitle'), description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('adminCoursesPage.toasts.orderUpdateErrorTitle'), description: error instanceof Error ? error.message : t('adminCoursesPage.toasts.unknownError'), variant: 'destructive' });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const getPriceDisplay = (course: Video) => {
    const originalPriceFormatted = `ARS $${course.priceArs.toLocaleString()}`;
    if (course.discountInput && course.finalPriceArs !== undefined && course.finalPriceArs < course.priceArs) {
      const finalPriceFormatted = `ARS $${course.finalPriceArs.toLocaleString()}`;
      return (
        <>
          <span className="line-through text-muted-foreground text-xs mr-1">{originalPriceFormatted}</span>
          <span className="text-primary font-semibold">{finalPriceFormatted}</span>
        </>
      );
    }
    return <span className="font-semibold">{originalPriceFormatted}</span>;
  };
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <VideoIcon className="mr-3 h-8 w-8" /> {t('adminCoursesPage.title')}
        </h1>
        <div className="flex gap-2">
          {isOrderChanged && (
            <Button onClick={handleSaveOrder} disabled={isSavingOrder}>
              {isSavingOrder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('adminCoursesPage.saveOrderButton')}
            </Button>
          )}
          <Button onClick={() => handleOpenModal()}>
            <PlusCircle className="mr-2 h-4 w-4" /> {t('adminCoursesPage.addCourseButton')}
          </Button>
        </div>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminCoursesPage.listTitle')}</CardTitle>
          <CardDescription>{t('adminCoursesPage.listDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('adminCoursesPage.table.title')}</TableHead>
                <TableHead>{t('adminCoursesPage.table.price')}</TableHead>
                <TableHead>{t('adminCoursesPage.table.duration')}</TableHead>
                <TableHead className="w-[10%]">{t('adminCoursesPage.table.views')}</TableHead>
                <TableHead className="w-[15%]">{t('adminCoursesPage.table.lastUpdated')}</TableHead>
                <TableHead className="text-right w-[20%]">{t('adminCoursesPage.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">{t('adminCoursesPage.noCourses')}</TableCell></TableRow>
              ) : (
                courses.map((course, index) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell>{getPriceDisplay(course)}</TableCell>
                    <TableCell>{course.duration || 'N/A'}</TableCell>
                    <TableCell className="text-center">{course.views || 0}</TableCell>
                    <TableCell>{new Date(course.updatedAt).toLocaleDateString(language)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleMove(course.id, 'up')} disabled={index === 0 || isSavingOrder} title="Move Up">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleMove(course.id, 'down')} disabled={index === courses.length - 1 || isSavingOrder} title="Move Down">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="hover:text-primary" onClick={() => handleOpenModal(course)}>
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
                            <AlertDialogTitle>{t('adminCoursesPage.deleteDialog.title')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('adminCoursesPage.deleteDialog.description', { courseTitle: course.title })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('adminCoursesPage.deleteDialog.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCourse(course.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                              {t('adminCoursesPage.deleteDialog.delete')}
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
              {editingCourse ? t('adminCoursesPage.editModal.title') : t('adminCoursesPage.addModal.title')}
            </DialogTitle>
            <DialogDescription>
              {editingCourse ? t('adminCoursesPage.editModal.description') : t('adminCoursesPage.addModal.description')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <div className="max-h-[65vh] overflow-y-auto px-2 py-1">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>{t('adminCoursesPage.form.title')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>{t('adminCoursesPage.form.description')}</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="previewImageUrl" render={({ field }) => (
                <FormItem><FormLabel>{t('adminCoursesPage.form.previewImageUrl')} ({t('adminCoursesPage.form.optional')})</FormLabel><FormControl><Input placeholder="https://placehold.co/600x400" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="videoUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminCoursesPage.form.videoUrl')}</FormLabel>
                  <FormControl><Input placeholder="https://example.com/video.mp4 or YouTube URL" {...field} /></FormControl>
                  <ShadFormDescription>
                    {t('adminCoursesPage.form.videoUrlDescription')}
                  </ShadFormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="priceArs" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center">
                            <Tag className="mr-2 h-4 w-4 text-muted-foreground"/>
                            {t('adminCoursesPage.form.priceArs')}
                        </FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="discountInput" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center">
                             <Percent className="mr-2 h-4 w-4 text-muted-foreground"/>
                            {t('adminCoursesPage.form.discountInput')} ({t('adminCoursesPage.form.optional')})
                        </FormLabel>
                        <FormControl><Input placeholder="Ej: 10% o 89990" {...field} /></FormControl>
                         <ShadFormDescription>{t('adminCoursesPage.form.discountInputDescription')}</ShadFormDescription>
                        <FormMessage />
                    </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="duration" render={({ field }) => (
                <FormItem><FormLabel>{t('adminCoursesPage.form.duration')} ({t('adminCoursesPage.form.optional')})</FormLabel><FormControl><Input placeholder="e.g., 45min, 1h 30m" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
             </div>
              <DialogFooter className="pt-4 border-t mt-4">
                <DialogClose asChild><Button type="button" variant="outline">{t('adminCoursesPage.form.cancel')}</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCourse ? t('adminCoursesPage.form.saveChanges') : t('adminCoursesPage.form.createCourse')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    