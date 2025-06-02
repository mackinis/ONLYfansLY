
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as ShadFormDescription } from "@/components/ui/form";
import { Smartphone, Save, Loader2, Settings2, Apple as AppleIcon, Image as ImageIconLucide } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import type { SiteSettings } from '@/lib/types';
import { useTranslation } from '@/context/I18nContext';
import { Separator } from '@/components/ui/separator';

const mobileAppsSettingsFormSchema = z.object({
  mobileAppsSectionTitle: z.string().min(1, { message: "Section title cannot be empty." }).default("Our Apps"),
  showMobileAppsSection: z.boolean().default(false),
  showAndroidApp: z.boolean().default(false),
  androidAppLink: z.string().url({ message: "Must be a valid URL." }).optional().or(z.literal('')),
  androidAppIconUrl: z.string().url({ message: "Android app icon URL must be valid." }).optional().or(z.literal("")),
  showIosApp: z.boolean().default(false),
  iosAppLink: z.string().url({ message: "Must be a valid URL." }).optional().or(z.literal('')),
  iosAppIconUrl: z.string().url({ message: "iOS app icon URL must be valid." }).optional().or(z.literal("")),
});

type MobileAppsSettingsFormValues = z.infer<typeof mobileAppsSettingsFormSchema>;

export default function AdminMobileAppsSettingsPage() {
  const { t, siteSettings: currentGlobalSettings, refreshSiteSettings, isLoadingSettings } = useTranslation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MobileAppsSettingsFormValues>({
    resolver: zodResolver(mobileAppsSettingsFormSchema),
    defaultValues: {
      mobileAppsSectionTitle: 'Our Apps',
      showMobileAppsSection: false,
      showAndroidApp: false,
      androidAppLink: '',
      androidAppIconUrl: '',
      showIosApp: false,
      iosAppLink: '',
      iosAppIconUrl: '',
    },
  });

  useEffect(() => {
    if (currentGlobalSettings) {
      form.reset({
        mobileAppsSectionTitle: currentGlobalSettings.mobileAppsSectionTitle || 'Our Apps',
        showMobileAppsSection: currentGlobalSettings.showMobileAppsSection || false,
        showAndroidApp: currentGlobalSettings.showAndroidApp || false,
        androidAppLink: currentGlobalSettings.androidAppLink || '',
        androidAppIconUrl: currentGlobalSettings.androidAppIconUrl || '',
        showIosApp: currentGlobalSettings.showIosApp || false,
        iosAppLink: currentGlobalSettings.iosAppLink || '',
        iosAppIconUrl: currentGlobalSettings.iosAppIconUrl || '',
      });
    }
  }, [currentGlobalSettings, form]);

  async function onSubmit(data: MobileAppsSettingsFormValues) {
    setIsSubmitting(true);
    try {
      const payload = {
        mobileAppsSectionTitle: data.mobileAppsSectionTitle,
        showMobileAppsSection: data.showMobileAppsSection,
        showAndroidApp: data.showAndroidApp,
        androidAppLink: data.showAndroidApp ? data.androidAppLink : '',
        androidAppIconUrl: data.showAndroidApp ? data.androidAppIconUrl : '',
        showIosApp: data.showIosApp,
        iosAppLink: data.showIosApp ? data.iosAppLink : '',
        iosAppIconUrl: data.showIosApp ? data.iosAppIconUrl : '',
      };

      const response = await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();

      if (response.ok) {
        toast({ 
            title: t('adminMobileAppsPage.toasts.updateSuccessTitle'), 
            description: result.message || t('adminMobileAppsPage.toasts.updateSuccessDescription') 
        });
        await refreshSiteSettings(); 
      } else {
        toast({ 
            title: t('adminMobileAppsPage.toasts.updateErrorTitle'), 
            description: result.message || t('adminAccountPage.toasts.genericError'), 
            variant: 'destructive' 
        });
      }
    } catch (error) {
      toast({ 
          title: t('adminMobileAppsPage.toasts.updateErrorTitle'), 
          description: error instanceof Error ? error.message : t('adminAccountPage.toasts.genericError'), 
          variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (isLoadingSettings || !currentGlobalSettings) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <Smartphone className="mr-3 h-8 w-8" /> {t('adminMobileAppsPage.title')}
        </h1>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminMobileAppsPage.cardTitle')}</CardTitle>
          <CardDescription>{t('adminMobileAppsPage.cardDescription')}</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 max-h-[75vh] overflow-y-auto pr-3">
              <FormField control={form.control} name="mobileAppsSectionTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminMobileAppsPage.sectionTitleLabel')}</FormLabel>
                  <FormControl><Input placeholder={t('adminMobileAppsPage.sectionTitlePlaceholder')} {...field} /></FormControl>
                  <ShadFormDescription>{t('adminMobileAppsPage.sectionTitleDescription')}</ShadFormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="showMobileAppsSection" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t('adminMobileAppsPage.showSectionLabel')}</FormLabel>
                    <ShadFormDescription>{t('adminMobileAppsPage.showSectionDescription')}</ShadFormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              {form.watch('showMobileAppsSection') && (
                <>
                  <Separator className="my-6" />
                  
                  <Card className="p-4 border-border/70">
                    <CardHeader className="p-2">
                      <CardTitle className="text-xl font-medium text-primary flex items-center">
                        <Smartphone className="mr-2 h-5 w-5" /> {t('adminMobileAppsPage.androidAppCardTitle')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-2">
                      <FormField control={form.control} name="showAndroidApp" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>{t('adminMobileAppsPage.showAndroidAppLabel')}</FormLabel>
                            <ShadFormDescription>{t('adminMobileAppsPage.showAndroidAppDescription')}</ShadFormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      {form.watch('showAndroidApp') && (
                        <>
                          <FormField control={form.control} name="androidAppLink" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('adminMobileAppsPage.androidAppLinklabel')}</FormLabel>
                              <FormControl><Input type="url" placeholder={t('adminMobileAppsPage.androidAppLinkPlaceholder')} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="androidAppIconUrl" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center">
                                <ImageIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />
                                {t('adminMobileAppsPage.androidAppIconUrlLabel')}
                              </FormLabel>
                              <FormControl><Input type="url" placeholder={t('adminMobileAppsPage.androidAppIconUrlPlaceholder')} {...field} /></FormControl>
                              <ShadFormDescription>{t('adminMobileAppsPage.appIconUrlDescription')}</ShadFormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="p-4 border-border/70">
                     <CardHeader className="p-2">
                      <CardTitle className="text-xl font-medium text-primary flex items-center">
                        <AppleIcon className="mr-2 h-5 w-5" /> {t('adminMobileAppsPage.iosAppCardTitle')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-2">
                      <FormField control={form.control} name="showIosApp" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>{t('adminMobileAppsPage.showIosAppLabel')}</FormLabel>
                            <ShadFormDescription>{t('adminMobileAppsPage.showIosAppDescription')}</ShadFormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      {form.watch('showIosApp') && (
                        <>
                          <FormField control={form.control} name="iosAppLink" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('adminMobileAppsPage.iosAppLinklabel')}</FormLabel>
                              <FormControl><Input type="url" placeholder={t('adminMobileAppsPage.iosAppLinkPlaceholder')} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="iosAppIconUrl" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center">
                                <ImageIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />
                                {t('adminMobileAppsPage.iosAppIconUrlLabel')}
                              </FormLabel>
                              <FormControl><Input type="url" placeholder={t('adminMobileAppsPage.iosAppIconUrlPlaceholder')} {...field} /></FormControl>
                              <ShadFormDescription>{t('adminMobileAppsPage.appIconUrlDescription')}</ShadFormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
            <CardFooter className="border-t pt-6 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> {t('adminMobileAppsPage.saveButton')}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
