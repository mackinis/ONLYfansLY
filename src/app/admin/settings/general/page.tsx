
'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as ShadFormDescription } from "@/components/ui/form";
import { Settings2, Save, Loader2, PlusCircle, Trash2, Link as LinkIcon, Sparkles, Info } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { updateSiteSettings } from '@/lib/actions';
import type { SiteSettings, SocialLink } from '@/lib/types';
import { useTranslation } from '@/context/I18nContext';
import { Separator } from '@/components/ui/separator';

const socialLinkSchema = z.object({
  id: z.string().default(() => `social-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
  name: z.string().min(1, { message: "Social network name cannot be empty." }),
  url: z.string().url({ message: "Must be a valid URL."}).or(z.literal('')),
  iconName: z.string().optional(),
});

const siteSettingsFormSchema = z.object({
  siteTitle: z.string().min(1, { message: "Site title cannot be empty." }),
  siteIconUrl: z.string().url({ message: "Must be a valid URL."}).optional().or(z.literal('')),
  heroTitle: z.string().min(1, { message: "Hero title cannot be empty." }),
  heroSubtitle: z.string().min(1, { message: "Hero subtitle cannot be empty." }),
  maintenanceMode: z.boolean(),
  socialLinks: z.array(socialLinkSchema).optional().default([]),
  aiCurationEnabled: z.boolean().default(true),
  aiCurationMinTestimonials: z.coerce.number().int().min(0, { message: "Minimum must be 0 or greater."}).default(5),
});

type SiteSettingsFormValues = z.infer<typeof siteSettingsFormSchema>;

export default function AdminGeneralSettingsPage() {
  const { t, siteSettings: currentGlobalSettings, refreshSiteSettings, isLoadingSettings } = useTranslation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SiteSettingsFormValues>({
    resolver: zodResolver(siteSettingsFormSchema),
    defaultValues: {
      siteTitle: 'Aurum Media',
      siteIconUrl: '',
      heroTitle: 'Discover Aurum Media',
      heroSubtitle: 'Immerse yourself in a curated collection of premium video content, designed to inspire and captivate.',
      maintenanceMode: false,
      socialLinks: [],
      aiCurationEnabled: true,
      aiCurationMinTestimonials: 5,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "socialLinks",
  });

  useEffect(() => {
    if (currentGlobalSettings) {
      form.reset({
        siteTitle: currentGlobalSettings.siteTitle || 'Aurum Media',
        siteIconUrl: currentGlobalSettings.siteIconUrl || '',
        heroTitle: currentGlobalSettings.heroTitle || 'Discover Aurum Media',
        heroSubtitle: currentGlobalSettings.heroSubtitle || 'Immerse yourself in a curated collection of premium video content, designed to inspire and captivate.',
        maintenanceMode: currentGlobalSettings.maintenanceMode || false,
        socialLinks: (currentGlobalSettings.socialLinks || []).map(link => ({
          id: link.id || `social-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Ensure ID exists
          name: link.name,
          url: link.url,
          iconName: link.iconName
        })),
        aiCurationEnabled: currentGlobalSettings.aiCurationEnabled !== undefined ? currentGlobalSettings.aiCurationEnabled : true,
        aiCurationMinTestimonials: currentGlobalSettings.aiCurationMinTestimonials !== undefined ? currentGlobalSettings.aiCurationMinTestimonials : 5,
      });
    }
  }, [currentGlobalSettings, form]);

  async function onSubmit(data: SiteSettingsFormValues) {
    setIsSubmitting(true);
    try {
      const socialLinksToSave = data.socialLinks?.map(link => ({
        ...link,
        id: link.id || `social-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })) || [];

      const result = await updateSiteSettings({
          siteTitle: data.siteTitle,
          siteIconUrl: data.siteIconUrl,
          heroTitle: data.heroTitle,
          heroSubtitle: data.heroSubtitle,
          maintenanceMode: data.maintenanceMode,
          socialLinks: socialLinksToSave,
          aiCurationEnabled: data.aiCurationEnabled,
          aiCurationMinTestimonials: data.aiCurationMinTestimonials,
      });

      if (result.success && result.updatedSettings) {
        toast({ title: t('adminGeneralPage.toasts.updateSuccessTitle'), description: t('adminGeneralPage.toasts.updateSuccessDescription') });
        await refreshSiteSettings(); 
      } else {
        toast({ title: t('adminGeneralPage.toasts.updateErrorTitle'), description: result.message || t('adminAccountPage.toasts.genericError'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('adminGeneralPage.toasts.updateErrorTitle'), description: error instanceof Error ? error.message : t('adminAccountPage.toasts.genericError'), variant: 'destructive' });
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
          <Settings2 className="mr-3 h-8 w-8" /> {t('adminGeneralPage.title')}
        </h1>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminGeneralPage.cardTitle')}</CardTitle>
          <CardDescription>
            {t('adminGeneralPage.cardDescription')}
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 max-h-[75vh] overflow-y-auto pr-3">
              {/* Basic Site Info */}
              <FormField control={form.control} name="siteTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminGeneralPage.form.siteTitle')}</FormLabel>
                  <FormControl><Input placeholder="Aurum Media Platform" {...field} /></FormControl>
                  <ShadFormDescription>{t('adminGeneralPage.form.siteTitleDescription')}</ShadFormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="siteIconUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminGeneralPage.form.siteIconUrl')}</FormLabel>
                  <FormControl><Input placeholder="https://example.com/icon.png" {...field} /></FormControl>
                  <ShadFormDescription>{t('adminGeneralPage.form.siteIconUrlDescription')}</ShadFormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <p className="text-xs text-muted-foreground">
                {t('adminGeneralPage.form.fileUploadNote')}
              </p>
              
              <Separator className="my-6" />

              {/* Homepage Hero Settings */}
              <h3 className="text-lg font-medium text-primary">{t('adminGeneralPage.form.heroSettingsTitle')}</h3>
              <FormField control={form.control} name="heroTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminGeneralPage.form.heroTitle')}</FormLabel>
                  <FormControl><Input placeholder={t('adminGeneralPage.form.heroTitlePlaceholder')} {...field} /></FormControl>
                  <ShadFormDescription>{t('adminGeneralPage.form.heroTitleDescription')}</ShadFormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="heroSubtitle" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminGeneralPage.form.heroSubtitle')}</FormLabel>
                  <FormControl><Textarea placeholder={t('adminGeneralPage.form.heroSubtitlePlaceholder')} rows={3} {...field} /></FormControl>
                  <ShadFormDescription>{t('adminGeneralPage.form.heroSubtitleDescription')}</ShadFormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <Separator className="my-6" />
              
              {/* Social Media Links */}
              <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-primary">{t('adminGeneralPage.form.socialMediaTitle')}</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `social-${Date.now()}`, name: '', url: '', iconName: '' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> {t('adminGeneralPage.form.addSocialLink')}
                    </Button>
                </div>
                <ShadFormDescription className="mb-4">{t('adminGeneralPage.form.socialMediaDescription')}</ShadFormDescription>
                
                <div className="space-y-4">
                  {fields.map((item, index) => (
                    <div key={item.id} className="flex items-end space-x-2 p-3 border rounded-md">
                      <FormField
                        control={form.control}
                        name={`socialLinks.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>{t('adminGeneralPage.form.socialLinkName')}</FormLabel>
                            <FormControl><Input placeholder={t('adminGeneralPage.form.socialLinkNamePlaceholder')} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`socialLinks.${index}.url`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>{t('adminGeneralPage.form.socialLinkUrl')}</FormLabel>
                            <FormControl><Input placeholder="https://example.com" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} aria-label={t('adminGeneralPage.form.removeSocialLink')}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="my-6" />
              
              {/* AI Testimonial Curation Settings */}
              <h3 className="text-lg font-medium text-primary flex items-center">
                <Sparkles className="mr-2 h-5 w-5" /> {t('adminGeneralPage.form.aiCurationTitle')}
              </h3>
              <ShadFormDescription className="mb-4">{t('adminGeneralPage.form.aiCurationDescription')}</ShadFormDescription>
              
              <FormField control={form.control} name="aiCurationEnabled" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t('adminGeneralPage.form.enableAICuration')}</FormLabel>
                    <ShadFormDescription>{t('adminGeneralPage.form.enableAICurationDescription')}</ShadFormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="aiCurationMinTestimonials" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminGeneralPage.form.minTestimonialsForAICuration')}</FormLabel>
                  <FormControl><Input type="number" placeholder="5" {...field} /></FormControl>
                  <ShadFormDescription>{t('adminGeneralPage.form.minTestimonialsForAICurationDescription')}</ShadFormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <Separator className="my-6" />

              {/* Maintenance Mode */}
              <FormField control={form.control} name="maintenanceMode" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t('adminGeneralPage.form.maintenanceMode')}</FormLabel>
                    <ShadFormDescription>{t('adminGeneralPage.form.maintenanceModeDescription')}</ShadFormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )} />

            </CardContent>
            <CardFooter className="border-t pt-6 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> {t('adminGeneralPage.saveButton')}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
