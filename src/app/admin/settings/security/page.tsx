
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShieldCheck, Save, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import { useTranslation } from '@/context/I18nContext';

const passwordChangeFormSchema = z.object({
  newPassword: z.string().min(8, { message: "New password must be at least 8 characters." }),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type PasswordChangeFormValues = z.infer<typeof passwordChangeFormSchema>;

export default function AdminSecuritySettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeFormSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    async function fetchAdminId() {
      setIsLoadingAdmin(true);
      try {
        const response = await fetch('/api/admin/profile');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || t('adminSecurityPage.toasts.adminNotFound'));
        }
        const profile: UserProfile = await response.json();
        if (profile && profile.id) {
          setAdminId(profile.id);
        } else {
          toast({ title: t('adminSecurityPage.toasts.fetchErrorTitle'), description: t('adminSecurityPage.toasts.adminNotFound'), variant: 'destructive' });
        }
      } catch (error) {
        toast({ title: t('adminSecurityPage.toasts.fetchErrorTitle'), description: error instanceof Error ? error.message : t('adminAccountPage.toasts.genericError'), variant: 'destructive' });
      } finally {
        setIsLoadingAdmin(false);
      }
    }
    fetchAdminId();
  }, [toast, t]);


  async function onSubmit(data: PasswordChangeFormValues) {
    if (!adminId) {
        toast({ title: t('adminSecurityPage.toasts.errorTitle'), description: t('adminSecurityPage.toasts.adminIdMissing'), variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);
    const payload = {
      adminId: adminId,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword, // Though refine handles this, API might double check
    };

    try {
      const response = await fetch('/api/admin/security/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (response.ok && result.success) {
        toast({ title: t('adminSecurityPage.toasts.updateSuccessTitle'), description: result.message });
        form.reset();
      } else {
        toast({ title: t('adminSecurityPage.toasts.updateErrorTitle'), description: result.message || t('adminAccountPage.toasts.genericError'), variant: 'destructive' });
        if (result.errors) {
            Object.entries(result.errors).forEach(([field, errors]) => {
             if (Array.isArray(errors) && errors.length > 0) { // Check if errors is an array
                form.setError(field as keyof PasswordChangeFormValues, { message: errors[0] as string });
             }
          });
        }
      }
    } catch (error) {
      toast({ title: t('adminSecurityPage.toasts.updateErrorTitle'), description: error instanceof Error ? error.message : t('adminAccountPage.toasts.genericError'), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (isLoadingAdmin) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <ShieldCheck className="mr-3 h-8 w-8" /> {t('adminSecurityPage.title')}
        </h1>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminSecurityPage.cardTitle')}</CardTitle>
          <CardDescription>
            {t('adminSecurityPage.cardDescription')}
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminSecurityPage.form.newPassword')}</FormLabel>
                  <FormControl><PasswordInput placeholder="••••••••" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminSecurityPage.form.confirmPassword')}</FormLabel>
                  <FormControl><PasswordInput placeholder="••••••••" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
            <CardFooter className="border-t pt-6 flex justify-end">
              <Button type="submit" disabled={isSubmitting || !adminId}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> {t('adminSecurityPage.saveButton')}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
