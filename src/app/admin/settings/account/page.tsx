
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UserCircle, Save, Loader2, Image as ImageIcon } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
// Removed: import { getAdminProfile, updateAdminProfile } from '@/lib/actions';
import type { UserProfile } from '@/lib/types';
import { useTranslation } from '@/context/I18nContext';
import NextImage from 'next/image'; // Renombrado para evitar conflicto

const adminProfileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  surname: z.string().min(2, { message: "Surname must be at least 2 characters." }),
  email: z.string().email().readonly(),
  avatarUrl: z.string().url({ message: "Avatar URL must be a valid URL." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  dni: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
});

type AdminProfileFormValues = z.infer<typeof adminProfileFormSchema>;

export default function AdminAccountSettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [adminUser, setAdminUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);


  const form = useForm<AdminProfileFormValues>({
    resolver: zodResolver(adminProfileFormSchema),
    defaultValues: {
      name: '',
      surname: '',
      email: '',
      avatarUrl: '',
      phone: '',
      dni: '',
      address: '',
      postalCode: '',
      city: '',
      province: '',
      country: '',
    },
  });

  const watchedAvatarUrl = form.watch('avatarUrl');

  useEffect(() => {
    if (watchedAvatarUrl) {
      if (/\.(jpeg|jpg|gif|png|webp)$/i.test(watchedAvatarUrl)) {
        setAvatarPreview(watchedAvatarUrl);
      } else {
        setAvatarPreview(null);
      }
    } else {
      setAvatarPreview(null);
    }
  }, [watchedAvatarUrl]);

  useEffect(() => {
    async function fetchAdmin() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/profile');
        if (!response.ok) {
          throw new Error(await response.text() || t('adminAccountPage.toasts.fetchErrorDescription'));
        }
        const profile: UserProfile = await response.json();
        
        if (profile) {
          setAdminUser(profile);
          form.reset({
            name: profile.name || '',
            surname: profile.surname || '',
            email: profile.email, // Email is part of UserProfile type
            avatarUrl: profile.avatarUrl || '',
            phone: profile.phone || '',
            dni: profile.dni || '',
            address: profile.address || '',
            postalCode: profile.postalCode || '',
            city: profile.city || '',
            province: profile.province || '',
            country: profile.country || '',
          });
          setAvatarPreview(profile.avatarUrl || null);
        } else {
          toast({ title: t('adminAccountPage.toasts.fetchErrorTitle'), description: t('adminAccountPage.toasts.fetchErrorDescription'), variant: 'destructive' });
        }
      } catch (error) {
        toast({ title: t('adminAccountPage.toasts.fetchErrorTitle'), description: error instanceof Error ? error.message : t('adminAccountPage.toasts.genericError'), variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    }
    fetchAdmin();
  }, [form, toast, t]);

  async function onSubmit(data: AdminProfileFormValues) {
    if (!adminUser) return;
    setIsSubmitting(true);
    const { email, ...updateData } = data; // Email is readonly, not part of update payload
    try {
      const response = await fetch(`/api/admin/profile`, { // Using adminUser.id in URL
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updateData, adminId: adminUser.id }), // Pass adminId if your API expects it, or remove if API fetches it
      });
      const result = await response.json();

      if (response.ok && result.success) {
        toast({ title: t('adminAccountPage.toasts.updateSuccessTitle'), description: result.message });
        if (data.avatarUrl !== adminUser.avatarUrl || data.name !== adminUser.name) {
            window.dispatchEvent(new CustomEvent('adminProfileUpdated', { detail: { avatarUrl: data.avatarUrl, name: data.name }}));
        }
        // Re-fetch or update local state if necessary
        const updatedProfileResponse = await fetch('/api/admin/profile');
        if (updatedProfileResponse.ok) {
            const updatedProfile = await updatedProfileResponse.json();
            setAdminUser(updatedProfile);
        }
      } else {
        toast({ title: t('adminAccountPage.toasts.updateErrorTitle'), description: result.message || t('adminAccountPage.toasts.genericError'), variant: 'destructive' });
        if (result.errors) {
            Object.entries(result.errors).forEach(([field, errors]) => {
             if (Array.isArray(errors) && errors.length > 0) { // Check if errors is an array
                form.setError(field as keyof AdminProfileFormValues, { message: errors[0] as string });
             }
          });
        }
      }
    } catch (error) {
      toast({ title: t('adminAccountPage.toasts.updateErrorTitle'), description: error instanceof Error ? error.message : t('adminAccountPage.toasts.genericError'), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!adminUser) {
    return <div className="text-center text-muted-foreground py-10">{t('adminAccountPage.noAdminFound')}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <UserCircle className="mr-3 h-8 w-8" /> {t('adminAccountPage.title')}
        </h1>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminAccountPage.cardTitle')}</CardTitle>
          <CardDescription>
            {t('adminAccountPage.cardDescription')}
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>{t('adminAccountPage.form.name')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="surname" render={({ field }) => (
                  <FormItem><FormLabel>{t('adminAccountPage.form.surname')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>{t('adminAccountPage.form.email')}</FormLabel><FormControl><Input type="email" {...field} readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="avatarUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminAccountPage.form.avatarUrl')}</FormLabel>
                  <FormControl><Input placeholder={t('adminAccountPage.form.avatarUrlPlaceholder')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {avatarPreview ? (
                <div className="mt-2">
                  <NextImage src={avatarPreview} alt="Avatar Preview" width={80} height={80} className="rounded-full object-cover border border-border" data-ai-hint="avatar preview"/>
                </div>
              ) : watchedAvatarUrl && !form.formState.errors.avatarUrl ? (
                <div className="mt-2 flex items-center justify-center w-20 h-20 rounded-full bg-muted border border-border">
                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                </div>
              ) : null}


              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>{t('adminAccountPage.form.phone')}</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dni" render={({ field }) => (
                  <FormItem><FormLabel>{t('adminAccountPage.form.dni')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>{t('adminAccountPage.form.address')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="postalCode" render={({ field }) => (
                  <FormItem><FormLabel>{t('adminAccountPage.form.postalCode')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>{t('adminAccountPage.form.city')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="province" render={({ field }) => (
                  <FormItem><FormLabel>{t('adminAccountPage.form.province')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem><FormLabel>{t('adminAccountPage.form.country')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
            <CardFooter className="border-t pt-6 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> {t('adminAccountPage.saveButton')}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
