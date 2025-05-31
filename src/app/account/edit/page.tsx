
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Save, UserCog } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';
import type { UserProfile } from '@/lib/types';
import { getUserProfileById, updateUserEditableProfile } from '@/lib/actions';

const editProfileFormSchema = z.object({
  phone: z.string().min(1, { message: "El teléfono es requerido." }),
  address: z.string().min(1, { message: "La dirección es requerida." }),
  postalCode: z.string().min(1, { message: "El código postal es requerido." }),
  city: z.string().min(1, { message: "La ciudad es requerida." }),
  province: z.string().min(1, { message: "La provincia es requerida." }),
  country: z.string().min(1, { message: "El país es requerido." }),
});

type EditProfileFormValues = z.infer<typeof editProfileFormSchema>;

export default function EditAccountPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const form = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileFormSchema),
    defaultValues: {
      phone: '',
      address: '',
      postalCode: '',
      city: '',
      province: '',
      country: '',
    },
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = sessionStorage.getItem('aurum_user_id');
      const storedAdmin = sessionStorage.getItem('aurum_is_admin_logged_in');
      if (storedAdmin === 'true') {
        router.push('/admin'); // Admins should not be here
        return;
      }
      if (!storedUserId) {
        router.push('/login');
        return;
      }
      setUserId(storedUserId);
    }
  }, [router]);

  useEffect(() => {
    if (userId) {
      const fetchProfile = async () => {
        setIsLoading(true);
        try {
          const profile = await getUserProfileById(userId);
          if (profile) {
            form.reset({
              phone: profile.phone || '',
              address: profile.address || '',
              postalCode: profile.postalCode || '',
              city: profile.city || '',
              province: profile.province || '',
              country: profile.country || '',
            });
          } else {
            toast({ title: t('editAccountPage.toasts.profileErrorTitle'), description: t('editAccountPage.toasts.profileErrorDescription'), variant: 'destructive' });
            router.push('/account'); 
          }
        } catch (error) {
          toast({ title: t('editAccountPage.toasts.profileErrorTitle'), description: t('accountPage.toasts.genericError'), variant: 'destructive' });
        } finally {
          setIsLoading(false);
        }
      };
      fetchProfile();
    }
  }, [userId, form, toast, router, t]);

  async function onSubmit(data: EditProfileFormValues) {
    if (!userId) return;
    setIsSubmitting(true);
    try {
      const result = await updateUserEditableProfile(userId, data);
      if (result.success) {
        toast({ title: t('editAccountPage.toasts.updateSuccessTitle'), description: t('editAccountPage.toasts.updateSuccessDescription') });
        router.push('/account'); 
      } else {
        toast({ title: t('editAccountPage.toasts.updateErrorTitle'), description: result.message || t('accountPage.toasts.genericError'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('editAccountPage.toasts.updateErrorTitle'), description: t('accountPage.toasts.genericError'), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading && !form.formState.isDirty) { // Only show full page loader if not yet interacted
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 md:py-12">
        <Card className="w-full max-w-2xl mx-auto shadow-xl border-primary/20">
          <CardHeader>
            <CardTitle className="font-headline text-3xl text-primary flex items-center">
              <UserCog className="mr-3 h-8 w-8" /> {t('editAccountPage.title')}
            </CardTitle>
            <CardDescription>{t('editAccountPage.description')}</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>{t('editAccountPage.form.phone')}</FormLabel><FormControl><Input type="tel" placeholder={t('registerPage.form.phonePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>{t('editAccountPage.form.address')}</FormLabel><FormControl><Input placeholder={t('registerPage.form.addressPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem><FormLabel>{t('editAccountPage.form.postalCode')}</FormLabel><FormControl><Input placeholder={t('registerPage.form.postalCodePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>{t('editAccountPage.form.city')}</FormLabel><FormControl><Input placeholder={t('registerPage.form.cityPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="province" render={({ field }) => (
                    <FormItem><FormLabel>{t('editAccountPage.form.province')}</FormLabel><FormControl><Input placeholder={t('registerPage.form.provincePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="country" render={({ field }) => (
                    <FormItem><FormLabel>{t('editAccountPage.form.country')}</FormLabel><FormControl><Input placeholder={t('registerPage.form.countryPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </CardContent>
              <CardFooter className="border-t pt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <Button type="button" variant="outline" onClick={() => router.push('/account')} className="w-full sm:w-auto">
                  {t('editAccountPage.cancelButton')}
                </Button>
                <Button type="submit" disabled={isSubmitting || isLoading} className="w-full sm:w-auto">
                  {(isSubmitting || (isLoading && form.formState.isDirty)) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> {t('editAccountPage.saveButton')}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
